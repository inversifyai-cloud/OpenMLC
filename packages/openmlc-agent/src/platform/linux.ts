import { execFile, exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, unlink } from "fs/promises";
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

// ── new capabilities ──────────────────────────────────────────────────────────

export async function screenshotRaw(): Promise<Buffer> {
  const path = join(tmpdir(), `openmlc-raw-${Date.now()}.png`);
  try { await execFileP("scrot", [path]); } catch { await execFileP("import", ["-window", "root", path]); }
  const buf = await readFile(path);
  await unlink(path).catch(() => {});
  return buf;
}

export async function screenshotRegion(
  x: number, y: number, w: number, h: number, scale = 2
): Promise<{ image: string; width: number; height: number }> {
  const path = join(tmpdir(), `openmlc-region-${Date.now()}.png`);
  await execFileP("import", ["-window", "root", "-crop", `${w}x${h}+${x}+${y}`, "+repage", path]).catch(async () => {
    await execFileP("scrot", ["-a", `${x},${y},${w},${h}`, path]);
  });
  const scaledW = Math.round(w * scale), scaledH = Math.round(h * scale);
  if (scale !== 1) {
    await execP(`convert "${path}" -resize ${scaledW}x${scaledH}! "${path}"`).catch(() => {});
  }
  const buf = await readFile(path);
  await unlink(path).catch(() => {});
  return { image: buf.toString("base64"), width: scaledW, height: scaledH };
}

export async function cursorPosition(): Promise<{ x: number; y: number }> {
  const { stdout } = await execP("xdotool getmouselocation --shell");
  const xm = stdout.match(/X=(\d+)/); const ym = stdout.match(/Y=(\d+)/);
  if (!xm || !ym) throw new Error("Could not parse cursor position");
  return { x: parseInt(xm[1]), y: parseInt(ym[1]) };
}

export async function accessibilityTree(app?: string, maxDepth = 5): Promise<object> {
  const py = `
import json, sys
try:
  import pyatspi
  desktop = pyatspi.Registry.getDesktop(0)
  def walk(obj, depth):
    if depth <= 0: return None
    try:
      name = obj.name or ''
      role = obj.getRoleName() or ''
      desc = ''
      try: desc = obj.description or ''
      except: pass
      frame = None
      try:
        ext = obj.queryComponent().getExtents(pyatspi.DESKTOP_COORDS)
        frame = {'x': ext.x, 'y': ext.y, 'width': ext.width, 'height': ext.height}
      except: pass
      children = []
      for i in range(min(obj.childCount, 40)):
        c = walk(obj[i], depth - 1)
        if c: children.append(c)
      node = {'role': role, 'title': name, 'description': desc, 'frame': frame}
      if children: node['children'] = children
      return node
    except: return None
  target = ${app ? JSON.stringify(app) : 'None'}
  results = []
  for app_obj in desktop:
    if target and app_obj.name != target: continue
    node = walk(app_obj, ${maxDepth})
    if node: results.append(node)
  print(json.dumps({'windows': results}))
except ImportError:
  print(json.dumps({'error': 'pyatspi not available — install python3-pyatspi'}))
except Exception as e:
  print(json.dumps({'error': str(e)}))
`;
  const tmp = join(tmpdir(), `openmlc-at-${Date.now()}.py`);
  await writeFile(tmp, py, "utf8");
  try {
    const { stdout } = await execFileP("python3", [tmp], { timeout: 15000 });
    return JSON.parse(stdout.trim());
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function ocrViaTesseract(shotPath: string, offsetX = 0, offsetY = 0): Promise<Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>> {
  const outBase = join(tmpdir(), `openmlc-tess-${Date.now()}`);
  await execFileP("tesseract", [shotPath, outBase, "tsv"], { timeout: 30000 });
  const tsv = await readFile(`${outBase}.tsv`, "utf8").catch(() => "");
  await unlink(`${outBase}.tsv`).catch(() => {});
  const results: Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }> = [];
  for (const line of tsv.split("\n").slice(1)) {
    const cols = line.split("\t");
    if (cols.length < 12) continue;
    const word = cols[11]?.trim();
    if (!word) continue;
    const x = parseInt(cols[6]), y = parseInt(cols[7]), w = parseInt(cols[8]), h = parseInt(cols[9]);
    const conf = parseFloat(cols[10]) / 100;
    if (isNaN(x) || isNaN(y)) continue;
    results.push({ text: word, x: x + offsetX, y: y + offsetY, width: w, height: h, confidence: conf });
  }
  return results;
}

export async function ocrScreen(region?: { x: number; y: number; w: number; h: number }): Promise<{ blocks: Array<{ text: string; x: number; y: number; width: number; height: number }>; fullText: string }> {
  const shotPath = join(tmpdir(), `openmlc-ocr-${Date.now()}.png`);
  const ox = region?.x ?? 0, oy = region?.y ?? 0;
  if (region) {
    await execFileP("import", ["-window", "root", "-crop", `${region.w}x${region.h}+${region.x}+${region.y}`, "+repage", shotPath]).catch(async () => {
      await execFileP("scrot", ["-a", `${region.x},${region.y},${region.w},${region.h}`, shotPath]);
    });
  } else {
    try { await execFileP("scrot", [shotPath]); } catch { await execFileP("import", ["-window", "root", shotPath]); }
  }
  const results = await ocrViaTesseract(shotPath, ox, oy).catch(() => [] as any[]);
  await unlink(shotPath).catch(() => {});
  const blocks = results.map((r: any) => ({ text: r.text, x: r.x, y: r.y, width: r.width, height: r.height }));
  return { blocks, fullText: blocks.map((b: any) => b.text).join(" ") };
}

export async function findText(
  text: string,
  region?: { x: number; y: number; w: number; h: number }
): Promise<Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>> {
  const shotPath = join(tmpdir(), `openmlc-find-${Date.now()}.png`);
  const ox = region?.x ?? 0, oy = region?.y ?? 0;
  if (region) {
    await execFileP("import", ["-window", "root", "-crop", `${region.w}x${region.h}+${region.x}+${region.y}`, "+repage", shotPath]).catch(async () => {
      await execFileP("scrot", ["-a", `${region.x},${region.y},${region.w},${region.h}`, shotPath]);
    });
  } else {
    try { await execFileP("scrot", [shotPath]); } catch { await execFileP("import", ["-window", "root", shotPath]); }
  }
  const all = await ocrViaTesseract(shotPath, ox, oy).catch(() => [] as any[]);
  await unlink(shotPath).catch(() => {});
  const lower = text.toLowerCase();
  return all.filter((r: any) => r.text.toLowerCase().includes(lower)).sort((a: any, b: any) => b.confidence - a.confidence);
}

export async function runScript(
  script: string,
  language: "jxa" | "applescript" | "powershell" | "python"
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (language === "jxa" || language === "applescript") {
    return { stdout: "", stderr: `${language} is not supported on Linux`, exitCode: 1 };
  }
  if (language === "powershell") {
    return { stdout: "", stderr: "powershell is not supported on Linux (use python or bash via computer_bash)", exitCode: 1 };
  }
  const tmp = join(tmpdir(), `openmlc-script-${Date.now()}.py`);
  await writeFile(tmp, script, "utf8");
  let stdout = "", stderr = "", exitCode = 0;
  try {
    const r = await execFileP("python3", [tmp], { timeout: 30000 });
    stdout = r.stdout; stderr = r.stderr ?? "";
  } catch (err: any) {
    stdout = err.stdout ?? ""; stderr = err.stderr ?? err.message; exitCode = err.code ?? 1;
  } finally {
    await unlink(tmp).catch(() => {});
  }
  return { stdout, stderr, exitCode };
}
