// OpenMLC Browser Sidecar
// Plain Node, no TS. Playwright-backed HTTP service exposing a tiny
// session-based API used by the browser_* agent tools.
//
// Sessions are tracked in a Map keyed by sessionId. Each session owns one
// Playwright BrowserContext + Page. Sessions auto-expire after 10 minutes
// idle, and we hard-cap concurrent sessions at 5 (LRU evict oldest).

const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const { chromium } = require("playwright");
const crypto = require("crypto");

const PORT = parseInt(process.env.PORT || "3030", 10);
const MAX_SESSIONS = 5;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const VIEWPORT = { width: 1280, height: 800 };

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

/** @type {import('playwright').Browser | null} */
let browser = null;

/**
 * @typedef {{
 *   id: string,
 *   context: import('playwright').BrowserContext,
 *   page: import('playwright').Page,
 *   createdAt: number,
 *   lastUsedAt: number,
 * }} Session
 */
/** @type {Map<string, Session>} */
const sessions = new Map();

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  return browser;
}

function newSessionId() {
  return crypto.randomBytes(12).toString("hex");
}

async function evictIfFull() {
  if (sessions.size < MAX_SESSIONS) return;
  // Evict the LRU — smallest lastUsedAt
  let oldestId = null;
  let oldestStamp = Infinity;
  for (const [id, s] of sessions) {
    if (s.lastUsedAt < oldestStamp) {
      oldestStamp = s.lastUsedAt;
      oldestId = id;
    }
  }
  if (oldestId) await closeSession(oldestId);
}

async function closeSession(id) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  try { await s.context.close(); } catch {}
}

async function shotOf(page) {
  const buf = await page.screenshot({ type: "png", fullPage: false });
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function pageMeta(page) {
  let title = "";
  try { title = await page.title(); } catch {}
  return { url: page.url(), title };
}

// ── routes ─────────────────────────────────────────────────────────────────

app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

const createBody = z.object({ startUrl: z.string().url().optional() });

app.post("/session", async (req, res) => {
  const parsed = createBody.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
  }
  try {
    await evictIfFull();
    const br = await getBrowser();
    const context = await br.newContext({
      viewport: VIEWPORT,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OpenMLC-Browser",
    });
    const page = await context.newPage();
    if (parsed.data.startUrl) {
      try {
        await page.goto(parsed.data.startUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      } catch (err) {
        // fall through with whatever we have
      }
    }
    const id = newSessionId();
    const now = Date.now();
    sessions.set(id, { id, context, page, createdAt: now, lastUsedAt: now });
    const meta = await pageMeta(page);
    const screenshot = await shotOf(page);
    res.json({ sessionId: id, screenshot, ...meta });
  } catch (err) {
    console.error("[browser] /session failed", err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

const actionBody = z.object({
  action: z.enum(["navigate", "click", "type", "press", "scroll", "back", "forward", "extract"]),
  url: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
  key: z.string().optional(),
  direction: z.enum(["up", "down"]).optional(),
  amount: z.number().optional(),
  selector: z.string().optional(),
});

app.post("/session/:id/action", async (req, res) => {
  const id = req.params.id;
  const s = sessions.get(id);
  if (!s) return res.status(404).json({ error: "session not found" });

  const parsed = actionBody.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
  }
  const args = parsed.data;
  s.lastUsedAt = Date.now();

  try {
    const page = s.page;
    switch (args.action) {
      case "navigate":
        if (!args.url) return res.status(400).json({ error: "url required" });
        await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        break;
      case "click":
        if (typeof args.x !== "number" || typeof args.y !== "number") {
          return res.status(400).json({ error: "x,y required" });
        }
        await page.mouse.click(args.x, args.y);
        await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => {});
        break;
      case "type":
        if (typeof args.text !== "string") return res.status(400).json({ error: "text required" });
        await page.keyboard.type(args.text, { delay: 12 });
        break;
      case "press":
        if (!args.key) return res.status(400).json({ error: "key required" });
        await page.keyboard.press(args.key);
        await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => {});
        break;
      case "scroll": {
        const dir = args.direction === "up" ? -1 : 1;
        const amt = (args.amount && args.amount > 0 ? args.amount : 600) * dir;
        await page.evaluate((dy) => window.scrollBy(0, dy), amt);
        break;
      }
      case "back":
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
        break;
      case "forward":
        await page.goForward({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
        break;
      case "extract": {
        let text;
        if (args.selector) {
          text = await page
            .$$eval(args.selector, (els) => els.map((e) => (e.textContent || "").trim()).join("\n\n"))
            .catch(() => "");
        } else {
          text = await page.evaluate(() => document.body ? document.body.innerText : "").catch(() => "");
        }
        const meta = await pageMeta(page);
        return res.json({ text: String(text || "").slice(0, 60_000), ...meta });
      }
    }

    const meta = await pageMeta(page);
    const screenshot = await shotOf(page);
    res.json({ screenshot, ...meta });
  } catch (err) {
    console.error("[browser] action failed", id, args.action, err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

app.post("/session/:id/close", async (req, res) => {
  await closeSession(req.params.id).catch(() => {});
  res.status(200).json({ ok: true });
});

// idle reaper
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastUsedAt > IDLE_TIMEOUT_MS) {
      console.log("[browser] reaping idle session", id);
      closeSession(id).catch(() => {});
    }
  }
}, 60_000).unref();

const server = app.listen(PORT, () => {
  console.log(`[browser] listening on :${PORT}`);
});

async function shutdown() {
  console.log("[browser] shutting down");
  server.close();
  for (const id of [...sessions.keys()]) await closeSession(id).catch(() => {});
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
