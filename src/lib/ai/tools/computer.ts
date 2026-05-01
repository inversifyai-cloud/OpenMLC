// computer_* tools — drive the openmlc-agent daemon on the host machine.
// Pattern mirrors browser.ts exactly: persistScreenshot, isEnabled, ToolDefinition exports.

import { tool } from "ai";
import { z } from "zod";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { ToolContext, ToolDefinition, ToolName } from "./types";
import * as agent from "@/lib/computer/client";

async function persistComputerScreenshot(
  ctx: ToolContext,
  timestamp: number,
  dataUrl: string | undefined | null
): Promise<string | null> {
  if (!dataUrl) return null;
  let buf: Buffer;
  if (dataUrl.startsWith("data:image/")) {
    const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
    if (!m) return null;
    buf = Buffer.from(m[1], "base64");
  } else {
    // Already raw base64
    buf = Buffer.from(dataUrl, "base64");
  }
  const dir = join(process.cwd(), "uploads", ctx.profileId);
  await mkdir(dir, { recursive: true });
  const relPath = `uploads/${ctx.profileId}/computer-${timestamp}.png`;
  await writeFile(join(process.cwd(), relPath), buf);
  return relPath;
}

async function takeScreenshot(ctx: ToolContext): Promise<{ screenshotPath?: string }> {
  try {
    const result = await agent.screenshot(ctx.computerAgentToken!, ctx.computerAgentUrl);
    const ts = Date.now();
    const path = await persistComputerScreenshot(ctx, ts, result.image);
    return path ? { screenshotPath: `/${path}` } : {};
  } catch {
    return {};
  }
}

const isEnabled: ToolDefinition["isEnabled"] = ({ model, ctx }) =>
  !!ctx.computerAgentUrl && model.capabilities.includes("tools");

// ── screenshot ────────────────────────────────────────────────────────────────

export const computerScreenshotDefinition: ToolDefinition<"computer_screenshot"> = {
  name: "computer_screenshot",
  displayName: "Screenshot",
  verb: "Taking screenshot",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Capture a screenshot of the host machine's screen. Call this first before any interaction to see the current state. Returns a screenshotPath you can view.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await agent.screenshot(ctx.computerAgentToken!, ctx.computerAgentUrl);
        const ts = Date.now();
        const path = await persistComputerScreenshot(ctx, ts, result.image);
        return { success: true, screenshotPath: path ? `/${path}` : null, width: result.width, height: result.height };
      },
    }),
};

// ── click ─────────────────────────────────────────────────────────────────────

export const computerClickDefinition: ToolDefinition<"computer_click"> = {
  name: "computer_click",
  displayName: "Clicked",
  verb: "Clicking",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Click at pixel coordinates on the screen. Use computer_screenshot first to see the screen and identify the correct coordinates. Returns a post-click screenshot.",
      inputSchema: z.object({
        x: z.number().int().describe("X coordinate in screen pixels."),
        y: z.number().int().describe("Y coordinate in screen pixels."),
        button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button. Defaults to left."),
      }),
      execute: async ({ x, y, button }) => {
        await agent.mouseClick(ctx.computerAgentToken!, x, y, button, ctx.computerAgentUrl);
        const ss = await takeScreenshot(ctx);
        return { success: true, x, y, ...ss };
      },
    }),
};

// ── double click ──────────────────────────────────────────────────────────────

export const computerDoubleClickDefinition: ToolDefinition<"computer_double_click"> = {
  name: "computer_double_click",
  displayName: "Double clicked",
  verb: "Double-clicking",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Double-click at pixel coordinates on the screen. Returns a post-click screenshot.",
      inputSchema: z.object({
        x: z.number().int(),
        y: z.number().int(),
      }),
      execute: async ({ x, y }) => {
        await agent.mouseDoubleClick(ctx.computerAgentToken!, x, y, ctx.computerAgentUrl);
        const ss = await takeScreenshot(ctx);
        return { success: true, x, y, ...ss };
      },
    }),
};

// ── move ──────────────────────────────────────────────────────────────────────

export const computerMoveDefinition: ToolDefinition<"computer_move"> = {
  name: "computer_move",
  displayName: "Moved mouse",
  verb: "Moving mouse",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Move the mouse cursor to pixel coordinates without clicking.",
      inputSchema: z.object({
        x: z.number().int(),
        y: z.number().int(),
      }),
      execute: async ({ x, y }) => {
        await agent.mouseMove(ctx.computerAgentToken!, x, y, ctx.computerAgentUrl);
        return { success: true, x, y };
      },
    }),
};

// ── scroll ────────────────────────────────────────────────────────────────────

export const computerScrollDefinition: ToolDefinition<"computer_scroll"> = {
  name: "computer_scroll",
  displayName: "Scrolled",
  verb: "Scrolling",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Scroll at a position on the screen. Returns a post-scroll screenshot.",
      inputSchema: z.object({
        x: z.number().int(),
        y: z.number().int(),
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z.number().int().min(1).max(20).optional().describe("Number of scroll ticks. Default 3."),
      }),
      execute: async ({ x, y, direction, amount = 3 }) => {
        await agent.mouseScroll(ctx.computerAgentToken!, x, y, direction, amount, ctx.computerAgentUrl);
        const ss = await takeScreenshot(ctx);
        return { success: true, ...ss };
      },
    }),
};

// ── drag ──────────────────────────────────────────────────────────────────────

export const computerDragDefinition: ToolDefinition<"computer_drag"> = {
  name: "computer_drag",
  displayName: "Dragged",
  verb: "Dragging",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Click-drag from one position to another. Returns a post-drag screenshot.",
      inputSchema: z.object({
        fromX: z.number().int(),
        fromY: z.number().int(),
        toX: z.number().int(),
        toY: z.number().int(),
      }),
      execute: async ({ fromX, fromY, toX, toY }) => {
        await agent.mouseDrag(ctx.computerAgentToken!, fromX, fromY, toX, toY, ctx.computerAgentUrl);
        const ss = await takeScreenshot(ctx);
        return { success: true, ...ss };
      },
    }),
};

// ── type ──────────────────────────────────────────────────────────────────────

export const computerTypeDefinition: ToolDefinition<"computer_type"> = {
  name: "computer_type",
  displayName: "Typed",
  verb: "Typing",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Type text into the currently focused element. Click the target input first. Returns a post-type screenshot.",
      inputSchema: z.object({
        text: z.string().max(5000).describe("Text to type."),
      }),
      execute: async ({ text }) => {
        await agent.keyboardType(ctx.computerAgentToken!, text, ctx.computerAgentUrl);
        const ss = await takeScreenshot(ctx);
        return { success: true, ...ss };
      },
    }),
};

// ── key ───────────────────────────────────────────────────────────────────────

export const computerKeyDefinition: ToolDefinition<"computer_key"> = {
  name: "computer_key",
  displayName: "Pressed key",
  verb: "Pressing key",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Press a keyboard key or combination. Examples: key='Return', key='a' modifiers=['cmd','shift']. Returns a post-key screenshot.",
      inputSchema: z.object({
        key: z.string().min(1).max(40).describe("Key name: Return, Tab, Escape, space, a, F1, etc."),
        modifiers: z.array(z.enum(["cmd", "ctrl", "alt", "shift", "fn"])).optional(),
      }),
      execute: async ({ key, modifiers }) => {
        await agent.keyboardKey(ctx.computerAgentToken!, key, modifiers, ctx.computerAgentUrl);
        const ss = await takeScreenshot(ctx);
        return { success: true, ...ss };
      },
    }),
};

// ── bash ──────────────────────────────────────────────────────────────────────

export const computerBashDefinition: ToolDefinition<"computer_bash"> = {
  name: "computer_bash",
  displayName: "Ran shell command",
  verb: "Running shell command",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Run a shell command on the host machine. Returns stdout, stderr, and exit code. Prefer this over clicking for any terminal task. Ask the user before destructive commands.",
      inputSchema: z.object({
        command: z.string().max(4000).describe("Shell command to run."),
        timeout: z.number().int().min(1).max(120).optional().describe("Timeout in seconds. Default 30."),
        cwd: z.string().optional().describe("Working directory. Defaults to home directory."),
      }),
      execute: async ({ command, timeout, cwd }) => {
        const result = await agent.shellExec(ctx.computerAgentToken!, command, timeout, cwd, ctx.computerAgentUrl);
        return { success: result.exitCode === 0, ...result };
      },
    }),
};

// ── file read ─────────────────────────────────────────────────────────────────

export const computerFileReadDefinition: ToolDefinition<"computer_file_read"> = {
  name: "computer_file_read",
  displayName: "Read file",
  verb: "Reading file",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Read the contents of a file on the host machine.",
      inputSchema: z.object({
        path: z.string().max(1000).describe("Absolute file path."),
      }),
      execute: async ({ path }) => {
        const result = await agent.fileRead(ctx.computerAgentToken!, path, ctx.computerAgentUrl);
        const truncated = result.content.length > 51200;
        return {
          success: true,
          path,
          content: result.content.slice(0, 51200),
          encoding: result.encoding,
          truncated,
        };
      },
    }),
};

// ── file write ────────────────────────────────────────────────────────────────

export const computerFileWriteDefinition: ToolDefinition<"computer_file_write"> = {
  name: "computer_file_write",
  displayName: "Wrote file",
  verb: "Writing file",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Write content to a file on the host machine. Creates the file if it doesn't exist. Ask before overwriting existing files.",
      inputSchema: z.object({
        path: z.string().max(1000).describe("Absolute file path."),
        content: z.string().max(524288).describe("File content to write."),
        encoding: z.string().optional().describe("Encoding. Default utf8."),
      }),
      execute: async ({ path, content, encoding }) => {
        await agent.fileWrite(ctx.computerAgentToken!, path, content, encoding, ctx.computerAgentUrl);
        return { success: true, path, bytes: content.length };
      },
    }),
};

// ── file list ─────────────────────────────────────────────────────────────────

export const computerFileListDefinition: ToolDefinition<"computer_file_list"> = {
  name: "computer_file_list",
  displayName: "Listed files",
  verb: "Listing files",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "List the contents of a directory on the host machine.",
      inputSchema: z.object({
        path: z.string().max(1000).describe("Absolute directory path."),
      }),
      execute: async ({ path }) => {
        const result = await agent.fileList(ctx.computerAgentToken!, path, ctx.computerAgentUrl);
        return { success: true, path, entries: result.entries };
      },
    }),
};

// ── file delete ───────────────────────────────────────────────────────────────

export const computerFileDeleteDefinition: ToolDefinition<"computer_file_delete"> = {
  name: "computer_file_delete",
  displayName: "Deleted file",
  verb: "Deleting file",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Delete a file or empty directory on the host machine. Always confirm with the user before deleting.",
      inputSchema: z.object({
        path: z.string().max(1000).describe("Absolute path to delete."),
      }),
      execute: async ({ path }) => {
        await agent.fileDelete(ctx.computerAgentToken!, path, ctx.computerAgentUrl);
        return { success: true, path };
      },
    }),
};

// ── clipboard ─────────────────────────────────────────────────────────────────

export const computerClipboardReadDefinition: ToolDefinition<"computer_clipboard_read"> = {
  name: "computer_clipboard_read",
  displayName: "Read clipboard",
  verb: "Reading clipboard",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Read the current contents of the system clipboard.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await agent.clipboardRead(ctx.computerAgentToken!, ctx.computerAgentUrl);
        return { success: true, text: result.text };
      },
    }),
};

export const computerClipboardWriteDefinition: ToolDefinition<"computer_clipboard_write"> = {
  name: "computer_clipboard_write",
  displayName: "Wrote clipboard",
  verb: "Writing clipboard",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Write text to the system clipboard.",
      inputSchema: z.object({
        text: z.string().max(100000).describe("Text to place on the clipboard."),
      }),
      execute: async ({ text }) => {
        await agent.clipboardWrite(ctx.computerAgentToken!, text, ctx.computerAgentUrl);
        return { success: true };
      },
    }),
};

// ── app launch ────────────────────────────────────────────────────────────────

export const computerLaunchAppDefinition: ToolDefinition<"computer_launch_app"> = {
  name: "computer_launch_app",
  displayName: "Launched app",
  verb: "Launching app",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Launch an application on the host machine. On macOS use the app name (e.g. 'Safari', 'VS Code', 'Terminal'). On Linux use the binary name.",
      inputSchema: z.object({
        app: z.string().max(200).describe("Application name or binary."),
        args: z.array(z.string()).optional().describe("Optional arguments to pass to the app."),
      }),
      execute: async ({ app, args }) => {
        await agent.launchApp(ctx.computerAgentToken!, app, args, ctx.computerAgentUrl);
        await new Promise((r) => setTimeout(r, 1000));
        const ss = await takeScreenshot(ctx);
        return { success: true, app, ...ss };
      },
    }),
};

// ── system info ───────────────────────────────────────────────────────────────

export const computerSystemInfoDefinition: ToolDefinition<"computer_system_info"> = {
  name: "computer_system_info",
  displayName: "System info",
  verb: "Getting system info",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Get system information about the host machine: CPU, memory, disk, OS, uptime, hostname.",
      inputSchema: z.object({}),
      execute: async () => {
        const info = await agent.systemInfo(ctx.computerAgentToken!, ctx.computerAgentUrl);
        return { success: true, ...info };
      },
    }),
};

// ── registry ──────────────────────────────────────────────────────────────────

export const computerDefinitions: ToolDefinition[] = [
  computerScreenshotDefinition,
  computerClickDefinition,
  computerDoubleClickDefinition,
  computerMoveDefinition,
  computerScrollDefinition,
  computerDragDefinition,
  computerTypeDefinition,
  computerKeyDefinition,
  computerBashDefinition,
  computerFileReadDefinition,
  computerFileWriteDefinition,
  computerFileListDefinition,
  computerFileDeleteDefinition,
  computerClipboardReadDefinition,
  computerClipboardWriteDefinition,
  computerLaunchAppDefinition,
  computerSystemInfoDefinition,
];

export const COMPUTER_TOOL_NAMES: ToolName[] = computerDefinitions.map((d) => d.name);
