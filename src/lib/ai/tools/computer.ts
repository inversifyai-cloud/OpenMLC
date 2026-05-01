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

// ── screenshot region ─────────────────────────────────────────────────────────

export const computerScreenshotRegionDefinition: ToolDefinition<"computer_screenshot_region"> = {
  name: "computer_screenshot_region",
  displayName: "Zoom Screenshot",
  verb: "Zooming in",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Capture a zoomed-in screenshot of a specific region of the screen. Use this when you need to read small text or examine a specific UI area more closely. The returned image is scaled up (default 2x) for clarity.",
      inputSchema: z.object({
        x: z.number().describe("Left edge of the region in screen pixels"),
        y: z.number().describe("Top edge of the region in screen pixels"),
        width: z.number().describe("Width of the region in screen pixels"),
        height: z.number().describe("Height of the region in screen pixels"),
        scale: z.number().min(1).max(4).optional().describe("Zoom factor (default 2). Use 3-4 for very small UI elements."),
      }),
      execute: async ({ x, y, width, height, scale }) => {
        const result = await agent.screenshotRegion(ctx.computerAgentToken!, x, y, width, height, scale, ctx.computerAgentUrl);
        const ts = Date.now();
        const path = await persistComputerScreenshot(ctx, ts, result.image);
        return { screenshotPath: path ? `/${path}` : undefined, width: result.width, height: result.height };
      },
    }),
};

// ── accessibility tree ────────────────────────────────────────────────────────

export const computerAccessibilityTreeDefinition: ToolDefinition<"computer_accessibility_tree"> = {
  name: "computer_accessibility_tree",
  displayName: "Accessibility Tree",
  verb: "Reading UI elements",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Get the accessibility element tree of the frontmost app (or a named app). Returns a JSON tree of UI elements with their roles, labels, and screen coordinates. Use this to find buttons, inputs, and other elements by name rather than by pixel position. On macOS this uses the native Accessibility API.",
      inputSchema: z.object({
        app: z.string().optional().describe("App name to inspect (e.g. 'Safari', 'Finder'). Omit for the frontmost app."),
        max_depth: z.number().min(1).max(8).optional().describe("How deep to walk the element tree (default 5)."),
      }),
      execute: async ({ app, max_depth }) => {
        const result = await agent.accessibilityTree(ctx.computerAgentToken!, app, max_depth, ctx.computerAgentUrl);
        return { tree: result.tree };
      },
    }),
};

// ── find text ─────────────────────────────────────────────────────────────────

export const computerFindTextDefinition: ToolDefinition<"computer_find_text"> = {
  name: "computer_find_text",
  displayName: "Find Text",
  verb: "Finding text on screen",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Locate text on the screen using OCR and return its pixel coordinates. Use this to find buttons, labels, or any text before clicking. Returns matches sorted by confidence. On macOS uses the native Vision framework; falls back to Tesseract on other platforms.",
      inputSchema: z.object({
        text: z.string().describe("Text to search for (case-insensitive, partial match)."),
        region: z.object({
          x: z.number(), y: z.number(), width: z.number(), height: z.number(),
        }).optional().describe("Restrict search to this screen region (optional)."),
      }),
      execute: async ({ text, region }) => {
        const result = await agent.findText(ctx.computerAgentToken!, text, region, ctx.computerAgentUrl);
        const ts = Date.now();
        const screenshotPath = await takeScreenshot(ctx).then(r => r.screenshotPath);
        return { matches: result.matches, count: result.matches.length, screenshotPath };
      },
    }),
};

// ── ocr ───────────────────────────────────────────────────────────────────────

export const computerOcrDefinition: ToolDefinition<"computer_ocr"> = {
  name: "computer_ocr",
  displayName: "OCR",
  verb: "Reading screen text",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Extract all text from the screen (or a region) using OCR. Returns each text block with its position and the full text as a string. Use this to read dynamic content, error messages, or any text you need to process.",
      inputSchema: z.object({
        region: z.object({
          x: z.number(), y: z.number(), width: z.number(), height: z.number(),
        }).optional().describe("Restrict OCR to this screen region (optional, defaults to full screen)."),
      }),
      execute: async ({ region }) => {
        const result = await agent.ocrScreen(ctx.computerAgentToken!, region, ctx.computerAgentUrl);
        return { blocks: result.blocks, fullText: result.fullText, blockCount: result.blocks.length };
      },
    }),
};

// ── screen diff ───────────────────────────────────────────────────────────────

export const computerScreenDiffDefinition: ToolDefinition<"computer_screen_diff"> = {
  name: "computer_screen_diff",
  displayName: "Screen Diff",
  verb: "Checking what changed",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Take a screenshot and compare it to the previous one to see what changed. Use this after mouse or keyboard actions to verify the action had an effect. Returns changePercent — if it's near 0%, the action likely didn't register.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await agent.screenshotDiff(ctx.computerAgentToken!, ctx.computerAgentUrl);
        const ts = Date.now();
        const path = await persistComputerScreenshot(ctx, ts, result.image);
        return {
          screenshotPath: path ? `/${path}` : undefined,
          changePercent: result.changePercent,
          changedRegions: result.changedRegions,
          note: result.note,
        };
      },
    }),
};

// ── run script ────────────────────────────────────────────────────────────────

export const computerRunScriptDefinition: ToolDefinition<"computer_run_script"> = {
  name: "computer_run_script",
  displayName: "Run Script",
  verb: "Running script",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Run a script on the host machine. Use 'jxa' (JavaScript for Automation) or 'applescript' on macOS to control apps via their native API — far more reliable than pixel clicking for complex automation. Use 'python' for cross-platform scripting. 'powershell' on Windows. Returns stdout, stderr, and exit code.",
      inputSchema: z.object({
        script: z.string().describe("The script content to execute."),
        language: z.enum(["jxa", "applescript", "powershell", "python"]).describe("Script language. Use 'jxa' on macOS for native app control (Safari, Finder, etc)."),
      }),
      execute: async ({ script, language }) => {
        const result = await agent.runScript(ctx.computerAgentToken!, script, language, ctx.computerAgentUrl);
        const stdout = result.stdout.slice(0, 8192);
        const stderr = result.stderr.slice(0, 2048);
        return { stdout, stderr, exitCode: result.exitCode, success: result.exitCode === 0 };
      },
    }),
};

// ── cursor position ───────────────────────────────────────────────────────────

export const computerCursorPositionDefinition: ToolDefinition<"computer_cursor_position"> = {
  name: "computer_cursor_position",
  displayName: "Cursor Position",
  verb: "Getting cursor position",
  isEnabled,
  build: (ctx) =>
    tool({
      description: "Get the current mouse cursor position in screen coordinates. Useful for debugging hover states or confirming where the cursor is before a click.",
      inputSchema: z.object({}),
      execute: async () => {
        const pos = await agent.cursorPosition(ctx.computerAgentToken!, ctx.computerAgentUrl);
        return { x: pos.x, y: pos.y };
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
  computerScreenshotRegionDefinition,
  computerAccessibilityTreeDefinition,
  computerFindTextDefinition,
  computerOcrDefinition,
  computerScreenDiffDefinition,
  computerRunScriptDefinition,
  computerCursorPositionDefinition,
];

export const COMPUTER_TOOL_NAMES: ToolName[] = computerDefinitions.map((d) => d.name);
