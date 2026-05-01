import { execFile, exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileP = promisify(execFile);
const execP = promisify(exec);

export async function screenshot(): Promise<{ image: string; width: number; height: number }> {
  const path = join(tmpdir(), `openmlc-shot-${Date.now()}.png`);
  await execFileP("screencapture", ["-x", "-t", "png", path]);
  const buf = await readFile(path);
  await unlink(path).catch(() => {});
  // Get dimensions via sips
  let width = 1920, height = 1080;
  try {
    const { stdout } = await execFileP("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path]).catch(async () => {
      // path already deleted, try another way
      return { stdout: "" };
    });
    const wMatch = stdout.match(/pixelWidth:\s*(\d+)/);
    const hMatch = stdout.match(/pixelHeight:\s*(\d+)/);
    if (wMatch) width = parseInt(wMatch[1]);
    if (hMatch) height = parseInt(hMatch[1]);
  } catch {}
  return { image: buf.toString("base64"), width, height };
}

export async function mouseClick(x: number, y: number, button = "left"): Promise<void> {
  const btn = button === "right" ? "rc" : button === "middle" ? "mc" : "c";
  await execFileP("cliclick", [`${btn}:${x},${y}`]);
}

export async function mouseDoubleClick(x: number, y: number): Promise<void> {
  await execFileP("cliclick", [`dc:${x},${y}`]);
}

export async function mouseMove(x: number, y: number): Promise<void> {
  await execFileP("cliclick", [`m:${x},${y}`]);
}

export async function mouseScroll(x: number, y: number, direction: string, amount: number): Promise<void> {
  await execFileP("cliclick", [`m:${x},${y}`]);
  const dir = direction === "down" ? "d" : direction === "up" ? "u" : direction === "left" ? "l" : "r";
  await execFileP("cliclick", [`kd:${dir === "d" ? "arrow-down" : dir === "u" ? "arrow-up" : dir === "l" ? "arrow-left" : "arrow-right"}`]).catch(async () => {
    // Fall back to scroll wheel simulation via osascript
    const sign = direction === "down" ? 3 : direction === "up" ? -3 : 0;
    await execP(`osascript -e 'tell application "System Events" to scroll (the mouse)'`).catch(() => {});
  });
  // Simple approach: use cliclick scroll
  for (let i = 0; i < amount; i++) {
    await execFileP("cliclick", [direction === "up" ? "ku:arrow-up" : "kd:arrow-down"]).catch(() => {});
  }
}

export async function mouseDrag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
  await execFileP("cliclick", [`dd:${fromX},${fromY}`, `m:${toX},${toY}`, `du:${toX},${toY}`]);
}

export async function keyboardType(text: string): Promise<void> {
  // cliclick t: types text
  await execFileP("cliclick", [`t:${text}`]);
}

export async function keyboardKey(key: string, modifiers: string[] = []): Promise<void> {
  // Map our modifier names to osascript modifier names
  const modMap: Record<string, string> = {
    cmd: "command down",
    ctrl: "control down",
    alt: "option down",
    shift: "shift down",
    fn: "function down",
  };
  const mods = modifiers.map((m) => modMap[m]).filter(Boolean);
  // Map key names to osascript key names
  const keyMap: Record<string, string> = {
    Return: "return", Enter: "return",
    Tab: "tab", Escape: "escape", Esc: "escape",
    Delete: "delete", Backspace: "delete",
    space: "space", Space: "space",
    Up: "up arrow", Down: "down arrow", Left: "left arrow", Right: "right arrow",
    Home: "home", End: "end", PageUp: "page up", PageDown: "page down",
    F1: "F1", F2: "F2", F3: "F3", F4: "F4",
    F5: "F5", F6: "F6", F7: "F7", F8: "F8",
    F9: "F9", F10: "F10", F11: "F11", F12: "F12",
  };
  const osKey = keyMap[key] ?? key;
  const modStr = mods.length > 0 ? ` using {${mods.join(", ")}}` : "";
  await execP(`osascript -e 'tell application "System Events" to keystroke "${osKey.replace(/"/g, '\\"')}"${modStr}'`);
}

export async function clipboardRead(): Promise<string> {
  const { stdout } = await execFileP("pbpaste");
  return stdout;
}

export async function clipboardWrite(text: string): Promise<void> {
  const proc = execFile("pbcopy", (err) => { if (err) throw err; });
  proc.stdin!.write(text);
  proc.stdin!.end();
  await new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}`))));
  });
}

export async function launchApp(app: string, args: string[] = []): Promise<void> {
  if (args.length > 0) {
    await execFileP("open", ["-a", app, "--args", ...args]);
  } else {
    await execFileP("open", ["-a", app]);
  }
}

export async function listWindows(): Promise<Array<{ title: string; app: string; focused: boolean }>> {
  const script = `
    tell application "System Events"
      set windowList to {}
      repeat with p in (every process whose visible is true)
        set appName to name of p
        repeat with w in (windows of p)
          set end of windowList to {title:(name of w), app:appName}
        end repeat
      end repeat
      return windowList
    end tell
  `;
  try {
    const { stdout } = await execP(`osascript -e '${script.replace(/'/g, `'"'"'`)}'`);
    // Parse the output (comma-separated key:value pairs in AppleScript list format)
    const windows: Array<{ title: string; app: string; focused: boolean }> = [];
    const matches = stdout.matchAll(/title:([^,}]+), app:([^,}]+)/g);
    for (const m of matches) {
      windows.push({ title: m[1].trim(), app: m[2].trim(), focused: false });
    }
    return windows;
  } catch {
    return [];
  }
}

export async function focusWindow(title?: string, _pid?: number): Promise<void> {
  if (!title) return;
  const script = `tell application "${title}" to activate`;
  await execP(`osascript -e '${script}'`).catch(() => {});
}
