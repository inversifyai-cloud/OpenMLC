import express from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "./auth.js";
import { screenshotRouter } from "./routes/screenshot.js";
import { mouseRouter } from "./routes/mouse.js";
import { keyboardRouter } from "./routes/keyboard.js";
import { shellRouter } from "./routes/shell.js";
import { filesRouter } from "./routes/files.js";
import { clipboardRouter } from "./routes/clipboard.js";
import { appsRouter } from "./routes/apps.js";
import { systemRouter } from "./routes/system.js";
import { accessibilityRouter } from "./routes/accessibility.js";
import { visionRouter } from "./routes/vision.js";
import { scriptingRouter } from "./routes/scripting.js";

if (!process.env.AGENT_TOKEN) {
  console.error("Error: AGENT_TOKEN environment variable is required.");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "10mb" }));

// Status endpoint — no auth, used for health checks
app.get("/status", (_req, res) => {
  res.json({ ok: true, version: "0.2.0" });
});

const readLimit = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const writeLimit = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

app.use(authMiddleware);

app.use(readLimit, screenshotRouter);
app.use(readLimit, systemRouter);
app.use(readLimit, clipboardRouter);
app.use(readLimit, filesRouter);
app.use(readLimit, accessibilityRouter);
app.use(readLimit, visionRouter);

app.use(writeLimit, mouseRouter);
app.use(writeLimit, keyboardRouter);
app.use(writeLimit, shellRouter);
app.use(writeLimit, appsRouter);
app.use(writeLimit, scriptingRouter);

const PORT = parseInt(process.env.AGENT_PORT ?? "3031", 10);
app.listen(PORT, "127.0.0.1", () => {
  console.log(`openmlc-agent v0.2.0 listening on http://127.0.0.1:${PORT}`);
  console.log(`Platform: ${process.platform}`);
});

// ── Auto-shutdown: exit when OpenMLC becomes unreachable ───────────────────────
// Set WATCH_URL to the OpenMLC instance (e.g. http://host.docker.internal:3000)
// The agent will poll it and exit when it stops responding.
const WATCH_URL = process.env.WATCH_URL;
if (WATCH_URL) {
  console.log(`[watch] monitoring ${WATCH_URL} — agent will exit when it becomes unreachable`);
  let failures = 0;
  const FAIL_THRESHOLD = 3;
  const POLL_MS = 10_000;

  setInterval(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${WATCH_URL.replace(/\/$/, "")}/api/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        failures = 0;
      } else {
        failures++;
      }
    } catch {
      failures++;
    }
    if (failures >= FAIL_THRESHOLD) {
      console.log(`[watch] OpenMLC unreachable after ${FAIL_THRESHOLD} attempts — shutting down`);
      process.exit(0);
    }
  }, POLL_MS);
}
