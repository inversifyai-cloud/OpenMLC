import { execFile, exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, unlink } from "fs/promises";
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

// ── new capabilities ──────────────────────────────────────────────────────────

export async function screenshotRaw(): Promise<Buffer> {
  const path = join(tmpdir(), `openmlc-raw-${Date.now()}.png`);
  await execFileP("screencapture", ["-x", "-t", "png", path]);
  const buf = await readFile(path);
  await unlink(path).catch(() => {});
  return buf;
}

export async function screenshotRegion(
  x: number, y: number, w: number, h: number, scale = 2
): Promise<{ image: string; width: number; height: number }> {
  const path = join(tmpdir(), `openmlc-region-${Date.now()}.png`);
  await execFileP("screencapture", ["-x", "-t", "png", `-R${x},${y},${w},${h}`, path]);
  const scaledW = Math.round(w * scale);
  const scaledH = Math.round(h * scale);
  if (scale !== 1) {
    await execP(`sips -z ${scaledH} ${scaledW} "${path}"`).catch(() => {});
  }
  const buf = await readFile(path);
  await unlink(path).catch(() => {});
  return { image: buf.toString("base64"), width: scaledW, height: scaledH };
}

export async function cursorPosition(): Promise<{ x: number; y: number }> {
  const { stdout } = await execFileP("cliclick", ["p:"]);
  const m = stdout.trim().match(/(\d+),(\d+)/);
  if (!m) throw new Error("Could not parse cursor position from cliclick");
  return { x: parseInt(m[1]), y: parseInt(m[2]) };
}

export async function accessibilityTree(app?: string, maxDepth = 5): Promise<object> {
  const jxa = `
ObjC.import('AppKit');
function frame(el) {
  try {
    const p = el.attributeValue('AXPosition');
    const s = el.attributeValue('AXSize');
    if (p && s) return { x: Math.round(p.x), y: Math.round(p.y), width: Math.round(s.width), height: Math.round(s.height) };
  } catch(e) {}
  return null;
}
function attr(el, key) { try { return el.attributeValue(key); } catch(e) { return null; } }
function walk(el, depth) {
  if (depth <= 0) return null;
  const node = {
    role: attr(el, 'AXRole'),
    title: attr(el, 'AXTitle'),
    value: attr(el, 'AXValue'),
    description: attr(el, 'AXDescription'),
    enabled: attr(el, 'AXEnabled'),
    focused: attr(el, 'AXFocused'),
    frame: frame(el),
  };
  try {
    const kids = el.attributeValue('AXChildren');
    if (kids && kids.length > 0) {
      node.children = kids.slice(0, 40).map(c => walk(c, depth - 1)).filter(Boolean);
    }
  } catch(e) {}
  return node;
}
const se = Application('System Events');
const targetApp = ${app ? JSON.stringify(app) : 'null'};
let proc;
if (targetApp) {
  const matches = se.processes.whose({ name: targetApp });
  proc = matches.length > 0 ? matches[0] : null;
} else {
  const front = se.processes.whose({ frontmost: true });
  proc = front.length > 0 ? front[0] : null;
}
if (!proc) {
  JSON.stringify({ error: 'process not found' });
} else {
  const wins = proc.windows();
  JSON.stringify({ app: proc.name(), pid: proc.unixId(), windows: wins.slice(0, 5).map(w => walk(w, ${maxDepth})) });
}
`;
  const tmp = join(tmpdir(), `openmlc-jxa-${Date.now()}.js`);
  await writeFile(tmp, jxa, "utf8");
  try {
    const { stdout } = await execFileP("osascript", ["-l", "JavaScript", tmp], { timeout: 15000 });
    return JSON.parse(stdout.trim());
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function ocrViaPython(shotPath: string): Promise<Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>> {
  const py = `
import json, sys
try:
  import Vision
  from Foundation import NSURL
  url = NSURL.fileURLWithPath_("${shotPath.replace(/"/g, '\\"')}")
  req = Vision.VNRecognizeTextRequest.alloc().init()
  req.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
  handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
  handler.performRequests_error_([req], None)
  out = []
  for obs in (req.results() or []):
    cand = obs.topCandidates_(1)
    if not cand: continue
    c = cand[0]
    bb = obs.boundingBox()
    out.append({"text": c.string(), "confidence": float(c.confidence()), "xn": bb.origin.x, "yn": bb.origin.y, "wn": bb.size.width, "hn": bb.size.height})
  print(json.dumps({"ok": True, "results": out}))
except Exception as e:
  print(json.dumps({"ok": False, "error": str(e)}))
`;
  const tmp = join(tmpdir(), `openmlc-ocr-${Date.now()}.py`);
  await writeFile(tmp, py, "utf8");
  try {
    const { stdout } = await execFileP("python3", [tmp], { timeout: 20000 });
    const parsed = JSON.parse(stdout.trim());
    if (!parsed.ok) throw new Error(parsed.error);

    // Get image dimensions to denormalize coordinates
    let imgW = 1920, imgH = 1080;
    try {
      const { stdout: s } = await execP(`sips -g pixelWidth -g pixelHeight "${shotPath}"`);
      const wm = s.match(/pixelWidth:\s*(\d+)/); const hm = s.match(/pixelHeight:\s*(\d+)/);
      if (wm) imgW = parseInt(wm[1]); if (hm) imgH = parseInt(hm[1]);
    } catch {}

    return parsed.results.map((r: any) => ({
      text: r.text,
      confidence: r.confidence,
      x: Math.round(r.xn * imgW),
      y: Math.round((1 - r.yn - r.hn) * imgH), // Vision uses bottom-left origin
      width: Math.round(r.wn * imgW),
      height: Math.round(r.hn * imgH),
    }));
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function ocrViaTesseract(shotPath: string): Promise<Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>> {
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
    results.push({ text: word, x, y, width: w, height: h, confidence: conf });
  }
  return results;
}

export async function ocrScreen(region?: { x: number; y: number; w: number; h: number }): Promise<{ blocks: Array<{ text: string; x: number; y: number; width: number; height: number }>; fullText: string }> {
  const shotPath = join(tmpdir(), `openmlc-ocr-shot-${Date.now()}.png`);
  if (region) {
    await execFileP("screencapture", ["-x", "-t", "png", `-R${region.x},${region.y},${region.w},${region.h}`, shotPath]);
  } else {
    await execFileP("screencapture", ["-x", "-t", "png", shotPath]);
  }
  const ox = region?.x ?? 0, oy = region?.y ?? 0;
  let results: Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>;
  try {
    results = await ocrViaPython(shotPath);
  } catch {
    results = await ocrViaTesseract(shotPath);
  }
  await unlink(shotPath).catch(() => {});
  const blocks = results.map(r => ({ text: r.text, x: r.x + ox, y: r.y + oy, width: r.width, height: r.height }));
  return { blocks, fullText: blocks.map(b => b.text).join(" ") };
}

export async function findText(
  text: string,
  region?: { x: number; y: number; w: number; h: number }
): Promise<Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>> {
  const { blocks: allBlocks, fullText: _ } = await ocrScreen(region);
  const lower = text.toLowerCase();
  // Re-run to get confidence scores too
  const shotPath = join(tmpdir(), `openmlc-find-${Date.now()}.png`);
  if (region) {
    await execFileP("screencapture", ["-x", "-t", "png", `-R${region.x},${region.y},${region.w},${region.h}`, shotPath]);
  } else {
    await execFileP("screencapture", ["-x", "-t", "png", shotPath]);
  }
  const ox = region?.x ?? 0, oy = region?.y ?? 0;
  let all: Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>;
  try { all = await ocrViaPython(shotPath); } catch { all = await ocrViaTesseract(shotPath); }
  await unlink(shotPath).catch(() => {});
  return all
    .filter(r => r.text.toLowerCase().includes(lower))
    .map(r => ({ ...r, x: r.x + ox, y: r.y + oy }))
    .sort((a, b) => b.confidence - a.confidence);
}

export async function runScript(
  script: string,
  language: "jxa" | "applescript" | "powershell" | "python"
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const ext = language === "jxa" ? "js" : language === "applescript" ? "scpt" : language === "python" ? "py" : "ps1";
  const tmp = join(tmpdir(), `openmlc-script-${Date.now()}.${ext}`);
  await writeFile(tmp, script, "utf8");
  try {
    let stdout = "", stderr = "", exitCode = 0;
    try {
      if (language === "jxa") {
        const r = await execFileP("osascript", ["-l", "JavaScript", tmp], { timeout: 30000 });
        stdout = r.stdout; stderr = r.stderr ?? "";
      } else if (language === "applescript") {
        const r = await execFileP("osascript", [tmp], { timeout: 30000 });
        stdout = r.stdout; stderr = r.stderr ?? "";
      } else if (language === "python") {
        const r = await execFileP("python3", [tmp], { timeout: 30000 });
        stdout = r.stdout; stderr = r.stderr ?? "";
      } else {
        throw new Error("powershell not supported on macOS");
      }
    } catch (err: any) {
      stdout = err.stdout ?? ""; stderr = err.stderr ?? err.message; exitCode = err.code ?? 1;
    }
    return { stdout, stderr, exitCode };
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
