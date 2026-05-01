import { execFile, exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileP = promisify(execFile);
const execP = promisify(exec);

export async function screenshot(): Promise<{ image: string; width: number; height: number }> {
  const path = join(tmpdir(), `openmlc-shot-${Date.now()}.png`);
  // Try scrot first, fall back to import (ImageMagick)
  try {
    await execFileP("scrot", [path]);
  } catch {
    await execFileP("import", ["-window", "root", path]);
  }
  const buf = await readFile(path);
  await unlink(path).catch(() => {});
  let width = 1920, height = 1080;
  try {
    const { stdout } = await execP(`identify -format "%wx%h" ${path}`);
    const m = stdout.match(/(\d+)x(\d+)/);
    if (m) { width = parseInt(m[1]); height = parseInt(m[2]); }
  } catch {}
  return { image: buf.toString("base64"), width, height };
}

export async function mouseClick(x: number, y: number, button = "left"): Promise<void> {
  const btn = button === "right" ? "3" : button === "middle" ? "2" : "1";
  await execFileP("xdotool", ["mousemove", String(x), String(y), "click", btn]);
}

export async function mouseDoubleClick(x: number, y: number): Promise<void> {
  await execFileP("xdotool", ["mousemove", String(x), String(y), "click", "--repeat", "2", "1"]);
}

export async function mouseMove(x: number, y: number): Promise<void> {
  await execFileP("xdotool", ["mousemove", String(x), String(y)]);
}

export async function mouseScroll(_x: number, _y: number, direction: string, amount: number): Promise<void> {
  const btn = direction === "up" ? "4" : direction === "down" ? "5" : direction === "left" ? "6" : "7";
  for (let i = 0; i < amount; i++) {
    await execFileP("xdotool", ["click", btn]);
  }
}

export async function mouseDrag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
  await execFileP("xdotool", [
    "mousemove", String(fromX), String(fromY),
    "mousedown", "1",
    "mousemove", String(toX), String(toY),
    "mouseup", "1",
  ]);
}

export async function keyboardType(text: string): Promise<void> {
  await execFileP("xdotool", ["type", "--clearmodifiers", text]);
}

export async function keyboardKey(key: string, modifiers: string[] = []): Promise<void> {
  const modMap: Record<string, string> = {
    cmd: "super", ctrl: "ctrl", alt: "alt", shift: "shift", fn: "",
  };
  const parts = [
    ...modifiers.map((m) => modMap[m]).filter(Boolean),
    key.toLowerCase().replace("return", "Return").replace("escape", "Escape"),
  ];
  await execFileP("xdotool", ["key", parts.join("+")]);
}

export async function clipboardRead(): Promise<string> {
  const { stdout } = await execFileP("xclip", ["-selection", "clipboard", "-o"]);
  return stdout;
}

export async function clipboardWrite(text: string): Promise<void> {
  const proc = execFile("xclip", ["-selection", "clipboard", "-i"], (err) => { if (err) throw err; });
  proc.stdin!.write(text);
  proc.stdin!.end();
  await new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`xclip exited ${code}`))));
  });
}

export async function launchApp(app: string, args: string[] = []): Promise<void> {
  const { spawn } = await import("child_process");
  const child = spawn(app, args, { detached: true, stdio: "ignore" });
  child.unref();
}

export async function listWindows(): Promise<Array<{ title: string; app: string; focused: boolean }>> {
  try {
    const { stdout } = await execP("xdotool search --name '' getwindowname %@");
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((title) => ({ title, app: "", focused: false }));
  } catch {
    return [];
  }
}

export async function focusWindow(title?: string, _pid?: number): Promise<void> {
  if (!title) return;
  await execP(`xdotool search --name "${title}" windowactivate`).catch(() => {});
}
