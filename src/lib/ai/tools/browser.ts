// browser_* tools — drive a sandboxed Playwright sidecar.
//
// Each tool reuses (or lazily creates) a single BrowserSession scoped to the
// current profile + conversation. The sidecar holds the actual browser; we
// just track its remote id + step count + last-screenshot in the DB so the
// tool-call timeline stays meaningful across turns.

import { tool } from "ai";
import { z } from "zod";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { ToolContext, ToolDefinition, ToolName } from "./types";
import {
  createSession as remoteCreate,
  runAction as remoteAction,
  type BrowserAction,
} from "@/lib/browser/client";

const BROWSER_ENABLED = process.env.OPENMLC_BROWSER_ENABLED === "true";

type BrowserSessionRow = {
  id: string;
  profileId: string;
  conversationId: string | null;
  remoteId: string | null;
  status: string;
  steps: number;
};

async function getOrCreateSession(
  ctx: ToolContext,
  startUrl?: string
): Promise<{ row: BrowserSessionRow; created: boolean; firstShot?: string; firstUrl?: string; firstTitle?: string }> {
  // Reuse the most recent active session for this conversation+profile.
  const existing = (await ctx.db.browserSession.findFirst({
    where: {
      profileId: ctx.profileId,
      conversationId: ctx.conversationId ?? null,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
  })) as BrowserSessionRow | null;

  if (existing && existing.remoteId) {
    return { row: existing, created: false };
  }

  const remote = await remoteCreate({ startUrl });
  const row = (await ctx.db.browserSession.create({
    data: {
      profileId: ctx.profileId,
      conversationId: ctx.conversationId ?? null,
      remoteId: remote.sessionId,
      startUrl: startUrl ?? null,
      status: "active",
      steps: 0,
    },
  })) as BrowserSessionRow;

  return {
    row,
    created: true,
    firstShot: remote.screenshot,
    firstUrl: remote.url,
    firstTitle: remote.title,
  };
}

async function persistScreenshot(
  ctx: ToolContext,
  sessionId: string,
  step: number,
  dataUrl: string | undefined | null
): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  const dir = join(process.cwd(), "uploads", ctx.profileId);
  await mkdir(dir, { recursive: true });
  const relPath = `uploads/${ctx.profileId}/browser-${sessionId}-${step}.png`;
  await writeFile(join(process.cwd(), relPath), buf);
  return relPath;
}

async function runStep(
  ctx: ToolContext,
  args: BrowserAction,
  opts: { startUrl?: string } = {}
): Promise<Record<string, unknown>> {
  const { row, created, firstShot, firstUrl, firstTitle } = await getOrCreateSession(
    ctx,
    opts.startUrl
  );
  if (!row.remoteId) throw new Error("browser session missing remoteId");

  // If we just created it AND the action is navigate to the same startUrl, the
  // create call already navigated. We still always run the action explicitly
  // for clarity (cheap idempotent re-nav for navigate; for everything else
  // it actually performs work).
  let result: { screenshot?: string; text?: string; url: string; title: string };
  if (created && args.action === "navigate" && firstUrl) {
    result = {
      url: firstUrl,
      title: firstTitle ?? "",
      screenshot: firstShot,
    };
  } else {
    result = await remoteAction(row.remoteId, args);
  }

  const nextStep = row.steps + 1;
  const isExtract = args.action === "extract";

  let screenshotPath: string | null = null;
  if (!isExtract && result.screenshot) {
    screenshotPath = await persistScreenshot(ctx, row.id, nextStep, result.screenshot);
  }

  await ctx.db.browserSession.update({
    where: { id: row.id },
    data: {
      steps: nextStep,
      lastScreenshot: screenshotPath ?? undefined,
    },
  });

  // TODO: emit inbox entry (browser_done) when the BrowserSession transitions to
  // status = "closed". Currently sessions remain "active" — there is no
  // production close path. When that lands, call recordInboxEntry with
  // kind: "browser_done", refType: "browser_session", refId: row.id.

  const out: Record<string, unknown> = {
    success: true,
    sessionId: row.id,
    action: args.action,
    url: result.url,
    title: result.title,
  };
  if (isExtract) {
    out.text = result.text ?? "";
    out.screenshot = null;
  } else {
    out.screenshot = result.screenshot ?? null;
    if (screenshotPath) out.screenshotPath = `/${screenshotPath}`;
  }
  return out;
}

const isEnabled: ToolDefinition["isEnabled"] = ({ model }) =>
  BROWSER_ENABLED && model.capabilities.includes("tools");

// ── individual tool definitions ────────────────────────────────────────────

export const browserNavigateDefinition: ToolDefinition<"browser_navigate"> = {
  name: "browser_navigate",
  displayName: "Browsed",
  verb: "Navigating",
  isEnabled,
  build: (ctx) =>
    tool({
      description:
        "Navigate the sandboxed browser to a URL. Returns a screenshot (1280x800) plus the resolved URL and page title. Always call this first when starting a browsing task.",
      inputSchema: z.object({
        url: z.string().url().describe("The fully-qualified URL to load."),
      }),
      execute: async ({ url }) => runStep(ctx, { action: "navigate", url }, { startUrl: url }),
    }),
};

export const browserClickDefinition: ToolDefinition<"browser_click"> = {
  name: "browser_click",
  displayName: "Clicked",
  verb: "Clicking",
  isEnabled,
  build: (ctx) =>
    tool({
      description:
        "Click at pixel coordinates within the current page (coordinates are in screenshot pixel space — 1280x800). Returns the post-click screenshot and page meta.",
      inputSchema: z.object({
        x: z.number().int().min(0).max(1280),
        y: z.number().int().min(0).max(800),
      }),
      execute: async ({ x, y }) => runStep(ctx, { action: "click", x, y }),
    }),
};

export const browserTypeDefinition: ToolDefinition<"browser_type"> = {
  name: "browser_type",
  displayName: "Typed",
  verb: "Typing",
  isEnabled,
  build: (ctx) =>
    tool({
      description:
        "Type text into the currently-focused element. Click an input first to focus it. Does NOT submit forms — use browser_press with key='Enter' for that.",
      inputSchema: z.object({
        text: z.string().max(2000),
      }),
      execute: async ({ text }) => runStep(ctx, { action: "type", text }),
    }),
};

export const browserPressDefinition: ToolDefinition<"browser_press"> = {
  name: "browser_press",
  displayName: "Pressed key",
  verb: "Pressing key",
  isEnabled,
  build: (ctx) =>
    tool({
      description:
        "Press a single named keyboard key (Enter, Tab, Escape, ArrowDown, etc). Use this to submit forms after typing.",
      inputSchema: z.object({
        key: z.string().min(1).max(40),
      }),
      execute: async ({ key }) => runStep(ctx, { action: "press", key }),
    }),
};

export const browserScrollDefinition: ToolDefinition<"browser_scroll"> = {
  name: "browser_scroll",
  displayName: "Scrolled",
  verb: "Scrolling",
  isEnabled,
  build: (ctx) =>
    tool({
      description:
        "Scroll the page up or down. `amount` is in pixels (default 600). Returns a fresh screenshot.",
      inputSchema: z.object({
        direction: z.enum(["up", "down"]),
        amount: z.number().int().min(50).max(5000).optional(),
      }),
      execute: async ({ direction, amount }) =>
        runStep(ctx, { action: "scroll", direction, amount }),
    }),
};

export const browserBackDefinition: ToolDefinition<"browser_back"> = {
  name: "browser_back",
  displayName: "Went back",
  verb: "Going back",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Navigate to the previous page in browser history.",
      inputSchema: z.object({}),
      execute: async () => runStep(ctx, { action: "back" }),
    }),
};

export const browserForwardDefinition: ToolDefinition<"browser_forward"> = {
  name: "browser_forward",
  displayName: "Went forward",
  verb: "Going forward",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Navigate to the next page in browser history (after a back).",
      inputSchema: z.object({}),
      execute: async () => runStep(ctx, { action: "forward" }),
    }),
};

export const browserExtractDefinition: ToolDefinition<"browser_extract"> = {
  name: "browser_extract",
  displayName: "Extracted text",
  verb: "Extracting text",
  isEnabled,
  build: (ctx) =>
    tool({
      description:
        "Extract text from the page. Optional CSS selector restricts the extraction; otherwise returns the full document innerText. Does NOT take a screenshot. Prefer this over re-screenshotting when you only need text.",
      inputSchema: z.object({
        selector: z.string().max(500).optional(),
      }),
      execute: async ({ selector }) => runStep(ctx, { action: "extract", selector }),
    }),
};

export const browserDefinitions: ToolDefinition[] = [
  browserNavigateDefinition,
  browserClickDefinition,
  browserTypeDefinition,
  browserPressDefinition,
  browserScrollDefinition,
  browserBackDefinition,
  browserForwardDefinition,
  browserExtractDefinition,
];

export const BROWSER_TOOL_NAMES: ToolName[] = browserDefinitions.map((d) => d.name);
