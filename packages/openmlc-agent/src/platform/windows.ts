import { execFile, exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
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
