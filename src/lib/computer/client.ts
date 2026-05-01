// HTTP client for the openmlc-agent daemon running on the host machine.
// Mirrors the pattern of src/lib/browser/client.ts.

const DEFAULT_URL = "http://host.docker.internal:3031";

function agentUrl(override?: string): string {
  return (override ?? process.env.OPENMLC_COMPUTER_URL ?? DEFAULT_URL).replace(/\/$/, "");
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (token) h["x-agent-token"] = token;
  return h;
}

async function getJson<T>(url: string, token: string | undefined, timeoutMs = 10_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: headers(token), signal: ctrl.signal });
    if (!res.ok) throw new Error(`agent ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function postJson<T>(url: string, body: unknown, token: string | undefined, timeoutMs = 60_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`agent ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function deleteJson<T>(url: string, body: unknown, token: string | undefined, timeoutMs = 15_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: headers(token),
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`agent ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// ── status ────────────────────────────────────────────────────────────────────

export type AgentStatus = { os: string; version: string; display?: string };

export async function isAvailable(baseUrl?: string): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2_000);
  try {
    const res = await fetch(`${agentUrl(baseUrl)}/status`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function getStatus(token?: string, baseUrl?: string): Promise<AgentStatus> {
  return getJson<AgentStatus>(`${agentUrl(baseUrl)}/status`, token, 3_000);
}

export function getAgentUrl(baseUrl?: string): string {
  return agentUrl(baseUrl);
}

// ── screenshot ────────────────────────────────────────────────────────────────

export type ScreenshotResult = { image: string; width: number; height: number };

export async function screenshot(token: string, baseUrl?: string): Promise<ScreenshotResult> {
  return getJson<ScreenshotResult>(`${agentUrl(baseUrl)}/screenshot`, token, 15_000);
}

// ── mouse ─────────────────────────────────────────────────────────────────────

export async function mouseClick(token: string, x: number, y: number, button?: string, baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/mouse/click`, { x, y, button }, token);
}

export async function mouseDoubleClick(token: string, x: number, y: number, baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/mouse/double-click`, { x, y }, token);
}

export async function mouseMove(token: string, x: number, y: number, baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/mouse/move`, { x, y }, token);
}

export async function mouseScroll(token: string, x: number, y: number, direction: string, amount: number, baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/mouse/scroll`, { x, y, direction, amount }, token);
}

export async function mouseDrag(token: string, fromX: number, fromY: number, toX: number, toY: number, baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/mouse/drag`, { fromX, fromY, toX, toY }, token);
}

// ── keyboard ──────────────────────────────────────────────────────────────────

export async function keyboardType(token: string, text: string, baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/keyboard/type`, { text }, token);
}

export async function keyboardKey(token: string, key: string, modifiers?: string[], baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/keyboard/key`, { key, modifiers }, token);
}

// ── shell ─────────────────────────────────────────────────────────────────────

export type ShellResult = { stdout: string; stderr: string; exitCode: number };

export async function shellExec(token: string, command: string, timeout?: number, cwd?: string, baseUrl?: string): Promise<ShellResult> {
  return postJson<ShellResult>(`${agentUrl(baseUrl)}/shell/exec`, { command, timeout, cwd }, token, (timeout ?? 30) * 1000 + 5000);
}

// ── files ─────────────────────────────────────────────────────────────────────

export type FileEntry = { name: string; type: "file" | "directory"; size: number; modified: string };

export async function fileRead(token: string, path: string, baseUrl?: string): Promise<{ content: string; encoding: string }> {
  const url = new URL(`${agentUrl(baseUrl)}/files/read`);
  url.searchParams.set("path", path);
  return getJson<{ content: string; encoding: string }>(url.toString(), token, 10_000);
}

export async function fileWrite(token: string, path: string, content: string, encoding?: string, baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/files/write`, { path, content, encoding }, token);
}

export async function fileList(token: string, path: string, baseUrl?: string): Promise<{ entries: FileEntry[] }> {
  const url = new URL(`${agentUrl(baseUrl)}/files/list`);
  url.searchParams.set("path", path);
  return getJson<{ entries: FileEntry[] }>(url.toString(), token, 10_000);
}

export async function fileDelete(token: string, path: string, baseUrl?: string): Promise<void> {
  await deleteJson<unknown>(`${agentUrl(baseUrl)}/files/delete`, { path }, token);
}

// ── clipboard ─────────────────────────────────────────────────────────────────

export async function clipboardRead(token: string, baseUrl?: string): Promise<{ text: string }> {
  return getJson<{ text: string }>(`${agentUrl(baseUrl)}/clipboard/read`, token, 5_000);
}

export async function clipboardWrite(token: string, text: string, baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/clipboard/write`, { text }, token);
}

// ── apps ──────────────────────────────────────────────────────────────────────

export async function launchApp(token: string, app: string, args?: string[], baseUrl?: string): Promise<void> {
  await postJson<unknown>(`${agentUrl(baseUrl)}/app/launch`, { app, args }, token);
}

// ── system ────────────────────────────────────────────────────────────────────

export async function systemInfo(token: string, baseUrl?: string): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(`${agentUrl(baseUrl)}/system/info`, token, 10_000);
}
