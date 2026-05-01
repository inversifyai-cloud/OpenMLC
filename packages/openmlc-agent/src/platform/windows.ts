import { execFile, exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, unlink } from "fs/promises";
import { tmpdir, homedir } from "os";
import { join } from "path";

const execFileP = promisify(execFile);
const execP = promisify(exec);

export async function screenshot(): Promise<{ image: string; width: number; height: number }> {
  const path = join(tmpdir(), `openmlc-shot-${Date.now()}.png`);
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
    $bmp.Save('${path.replace(/\\/g, "\\\\")}')
    Write-Output "$($b.Width)x$($b.Height)"
  `;
  const { stdout } = await execP(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`);
  const buf = await readFile(path);
  await unlink(path).catch(() => {});
  const m = stdout.match(/(\d+)x(\d+)/);
  const width = m ? parseInt(m[1]) : 1920;
  const height = m ? parseInt(m[2]) : 1080;
  return { image: buf.toString("base64"), width, height };
}

export async function mouseClick(x: number, y: number, button = "left"): Promise<void> {
  const btn = button === "right" ? "RightClick" : "Click";
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
    $m = New-Object System.Windows.Forms.MouseEventArgs([System.Windows.Forms.MouseButtons]::${button === "right" ? "Right" : "Left"}, 1, ${x}, ${y}, 0)
    [System.Windows.Forms.Application]::DoEvents()
    Add-Type -Name W -Namespace Native -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, int e);'
    [Native.W]::mouse_event(${button === "right" ? "8" : "2"}, 0, 0, 0, 0)
    [Native.W]::mouse_event(${button === "right" ? "16" : "4"}, 0, 0, 0, 0)
  `;
  await execP(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`);
}

export async function mouseDoubleClick(x: number, y: number): Promise<void> {
  await mouseClick(x, y);
  await mouseClick(x, y);
}

export async function mouseMove(x: number, y: number): Promise<void> {
  const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})`;
  await execP(`powershell -NoProfile -Command "${ps}"`);
}

export async function mouseScroll(_x: number, _y: number, direction: string, amount: number): Promise<void> {
  const delta = direction === "up" ? 120 * amount : -120 * amount;
  const ps = `Add-Type -Name W -Namespace Native -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, int e);'; [Native.W]::mouse_event(0x0800, 0, 0, ${delta}, 0)`;
  await execP(`powershell -NoProfile -Command "${ps}"`);
}

export async function mouseDrag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
  const ps = `
    Add-Type -Name W -Namespace Native -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, int e); [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);'
    [Native.W]::SetCursorPos(${fromX}, ${fromY})
    [Native.W]::mouse_event(2, 0, 0, 0, 0)
    [Native.W]::SetCursorPos(${toX}, ${toY})
    [Native.W]::mouse_event(4, 0, 0, 0, 0)
  `;
  await execP(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`);
}

export async function keyboardType(text: string): Promise<void> {
  const escaped = text.replace(/'/g, "''");
  const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;
  await execP(`powershell -NoProfile -Command "${ps}"`);
}

export async function keyboardKey(key: string, modifiers: string[] = []): Promise<void> {
  const modMap: Record<string, string> = { cmd: "%", ctrl: "^", alt: "%", shift: "+" };
  const keyMap: Record<string, string> = {
    Return: "{ENTER}", Enter: "{ENTER}", Tab: "{TAB}", Escape: "{ESC}", Esc: "{ESC}",
    Delete: "{DELETE}", Backspace: "{BACKSPACE}", space: " ", Space: " ",
    Up: "{UP}", Down: "{DOWN}", Left: "{LEFT}", Right: "{RIGHT}",
    Home: "{HOME}", End: "{END}", PageUp: "{PGUP}", PageDown: "{PGDN}",
    F1: "{F1}", F2: "{F2}", F3: "{F3}", F4: "{F4}", F5: "{F5}", F6: "{F6}",
    F7: "{F7}", F8: "{F8}", F9: "{F9}", F10: "{F10}", F11: "{F11}", F12: "{F12}",
  };
  const mappedKey = keyMap[key] ?? key;
  const modStr = modifiers.map((m) => modMap[m] ?? "").join("");
  const send = modifiers.length > 0 ? `${modStr}(${mappedKey})` : mappedKey;
  const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${send}')`;
  await execP(`powershell -NoProfile -Command "${ps}"`);
}

export async function clipboardRead(): Promise<string> {
  const { stdout } = await execP(`powershell -NoProfile -Command "Get-Clipboard"`);
  return stdout.trimEnd();
}

export async function clipboardWrite(text: string): Promise<void> {
  const escaped = text.replace(/'/g, "''");
  await execP(`powershell -NoProfile -Command "Set-Clipboard '${escaped}'"`);
}

export async function launchApp(app: string, args: string[] = []): Promise<void> {
  const { spawn } = await import("child_process");
  const child = spawn(app, args, { detached: true, stdio: "ignore", shell: true });
  child.unref();
}

export async function listWindows(): Promise<Array<{ title: string; app: string; focused: boolean }>> {
  try {
    const ps = `Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty MainWindowTitle`;
    const { stdout } = await execP(`powershell -NoProfile -Command "${ps}"`);
    return stdout.split("\n").filter(Boolean).map((title) => ({ title: title.trim(), app: "", focused: false }));
  } catch {
    return [];
  }
}

export async function focusWindow(title?: string, _pid?: number): Promise<void> {
  if (!title) return;
  const ps = `
    Add-Type -Name W -Namespace Native -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string t);'
    $h = [Native.W]::FindWindow([NullString]::Value, '${title.replace(/'/g, "''")}')
    if ($h -ne [IntPtr]::Zero) { [Native.W]::SetForegroundWindow($h) }
  `;
  await execP(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`).catch(() => {});
}

// ── new capabilities ──────────────────────────────────────────────────────────

export async function screenshotRaw(): Promise<Buffer> {
  const { image } = await screenshot();
  return Buffer.from(image, "base64");
}

export async function screenshotRegion(
  x: number, y: number, w: number, h: number, scale = 2
): Promise<{ image: string; width: number; height: number }> {
  const path = join(tmpdir(), `openmlc-region-${Date.now()}.png`).replace(/\\/g, "\\\\");
  const scaledW = Math.round(w * scale), scaledH = Math.round(h * scale);
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap(${w}, ${h})
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen(${x}, ${y}, 0, 0, New-Object System.Drawing.Size(${w}, ${h}))
    $scaled = New-Object System.Drawing.Bitmap($bmp, ${scaledW}, ${scaledH})
    $scaled.Save('${path}')
  `;
  await execP(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`);
  const buf = await readFile(path.replace(/\\\\/g, "\\"));
  await unlink(path.replace(/\\\\/g, "\\")).catch(() => {});
  return { image: buf.toString("base64"), width: scaledW, height: scaledH };
}

export async function cursorPosition(): Promise<{ x: number; y: number }> {
  const ps = `Add-Type -AssemblyName System.Windows.Forms; $p = [System.Windows.Forms.Cursor]::Position; Write-Output "$($p.X),$($p.Y)"`;
  const { stdout } = await execP(`powershell -NoProfile -Command "${ps}"`);
  const m = stdout.trim().match(/(\d+),(\d+)/);
  if (!m) throw new Error("Could not parse cursor position");
  return { x: parseInt(m[1]), y: parseInt(m[2]) };
}

export async function accessibilityTree(app?: string, maxDepth = 5): Promise<object> {
  const ps = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
function Walk($el, $depth) {
  if ($depth -le 0) { return $null }
  $props = @{}
  try { $props.role = $el.Current.ControlType.ProgrammaticName } catch {}
  try { $props.title = $el.Current.Name } catch {}
  try { $props.description = $el.Current.HelpText } catch {}
  try { $props.enabled = $el.Current.IsEnabled } catch {}
  try {
    $r = $el.Current.BoundingRectangle
    $props.frame = @{x=[int]$r.X; y=[int]$r.Y; width=[int]$r.Width; height=[int]$r.Height}
  } catch {}
  $kids = @()
  try {
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $child = $walker.GetFirstChild($el)
    $count = 0
    while ($child -ne $null -and $count -lt 40) {
      $node = Walk $child ($depth - 1)
      if ($node -ne $null) { $kids += $node }
      $child = $walker.GetNextSibling($child)
      $count++
    }
  } catch {}
  if ($kids.Count -gt 0) { $props.children = $kids }
  return $props
}
$root = [System.Windows.Automation.AutomationElement]::RootElement
$target = ${app ? `'${app.replace(/'/g, "''")}'` : '$null'}
$results = @()
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$win = $walker.GetFirstChild($root)
while ($win -ne $null) {
  $name = ''
  try { $name = $win.Current.Name } catch {}
  if ($target -eq $null -or $name -like "*$target*") {
    $node = Walk $win ${maxDepth}
    if ($node -ne $null) { $results += $node }
  }
  $win = $walker.GetNextSibling($win)
}
ConvertTo-Json @{windows=$results} -Depth 10 -Compress
`;
  const tmp = join(tmpdir(), `openmlc-uia-${Date.now()}.ps1`);
  await writeFile(tmp, ps, "utf8");
  try {
    const { stdout } = await execP(`powershell -NoProfile -File "${tmp}"`, { timeout: 15000 });
    return JSON.parse(stdout.trim());
  } catch (err: any) {
    return { error: err.message };
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

export async function ocrScreen(region?: { x: number; y: number; w: number; h: number }): Promise<{ blocks: Array<{ text: string; x: number; y: number; width: number; height: number }>; fullText: string }> {
  const shotPath = join(tmpdir(), `openmlc-ocr-${Date.now()}.png`).replace(/\\/g, "\\\\");
  const { image } = region
    ? await screenshotRegion(region.x, region.y, region.w, region.h, 1)
    : await screenshot();
  await writeFile(shotPath.replace(/\\\\/g, "\\"), Buffer.from(image, "base64"));

  const ps = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
function Await($task) { $task.GetAwaiter().GetResult() }
$file = Await([Windows.Storage.StorageFile]::GetFileFromPathAsync('${shotPath.replace(/\\\\/g, "\\\\\\\\")}'))
$stream = Await($file.OpenAsync([Windows.Storage.FileAccessMode]::Read))
$bmp = Await([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream))
$sb = Await($bmp.GetSoftwareBitmapAsync())
$eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$result = Await($eng.RecognizeAsync($sb))
$out = @()
foreach ($line in $result.Lines) {
  foreach ($word in $line.Words) {
    $b = $word.BoundingRect
    $out += @{text=$word.Text; x=[int]$b.X; y=[int]$b.Y; width=[int]$b.Width; height=[int]$b.Height}
  }
}
ConvertTo-Json @{blocks=$out; fullText=$result.Text} -Compress
`;
  const ox = region?.x ?? 0, oy = region?.y ?? 0;
  try {
    const { stdout } = await execP(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { timeout: 20000 });
    const parsed = JSON.parse(stdout.trim());
    const blocks = (parsed.blocks ?? []).map((b: any) => ({ text: b.text, x: b.x + ox, y: b.y + oy, width: b.width, height: b.height }));
    return { blocks, fullText: parsed.fullText ?? blocks.map((b: any) => b.text).join(" ") };
  } catch {
    return { blocks: [], fullText: "" };
  } finally {
    await unlink(shotPath.replace(/\\\\/g, "\\")).catch(() => {});
  }
}

export async function findText(
  text: string,
  region?: { x: number; y: number; w: number; h: number }
): Promise<Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>> {
  const { blocks } = await ocrScreen(region);
  const lower = text.toLowerCase();
  return blocks
    .filter(b => b.text.toLowerCase().includes(lower))
    .map(b => ({ ...b, confidence: 0.9 }));
}

export async function runScript(
  script: string,
  language: "jxa" | "applescript" | "powershell" | "python"
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (language === "jxa" || language === "applescript") {
    return { stdout: "", stderr: `${language} is not supported on Windows`, exitCode: 1 };
  }
  const ext = language === "python" ? "py" : "ps1";
  const tmp = join(tmpdir(), `openmlc-script-${Date.now()}.${ext}`);
  await writeFile(tmp, script, "utf8");
  let stdout = "", stderr = "", exitCode = 0;
  try {
    const cmd = language === "python" ? `python "${tmp}"` : `powershell -NoProfile -File "${tmp}"`;
    const r = await execP(cmd, { timeout: 30000 });
    stdout = r.stdout; stderr = r.stderr ?? "";
  } catch (err: any) {
    stdout = err.stdout ?? ""; stderr = err.stderr ?? err.message; exitCode = err.code ?? 1;
  } finally {
    await unlink(tmp).catch(() => {});
  }
  return { stdout, stderr, exitCode };
}
