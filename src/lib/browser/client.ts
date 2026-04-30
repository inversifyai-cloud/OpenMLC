// Tiny typed wrapper around the OpenMLC browser sidecar (services/browser).
// Reads OPENMLC_BROWSER_URL; defaults to http://browser:3030 (compose hostname).

const BROWSER_URL = (process.env.OPENMLC_BROWSER_URL ?? "http://browser:3030").replace(/\/$/, "");

export type BrowserMeta = { url: string; title: string };

export type SessionResult = BrowserMeta & {
  sessionId: string;
  screenshot: string; // data:image/png;base64,...
};

export type ActionResult = BrowserMeta & {
  screenshot?: string;
  text?: string;
};

export type BrowserAction =
  | { action: "navigate"; url: string }
  | { action: "click"; x: number; y: number }
  | { action: "type"; text: string }
  | { action: "press"; key: string }
  | { action: "scroll"; direction: "up" | "down"; amount?: number }
  | { action: "back" }
  | { action: "forward" }
  | { action: "extract"; selector?: string };

async function postJson<T>(path: string, body: unknown, timeoutMs = 60_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BROWSER_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`browser sidecar ${res.status}: ${txt.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function createSession(opts: { startUrl?: string } = {}): Promise<SessionResult> {
  return postJson<SessionResult>("/session", opts);
}

export async function runAction(
  sessionId: string,
  args: BrowserAction
): Promise<ActionResult> {
  return postJson<ActionResult>(`/session/${encodeURIComponent(sessionId)}/action`, args);
}

export async function closeSession(sessionId: string): Promise<void> {
  await postJson(`/session/${encodeURIComponent(sessionId)}/close`, {}).catch(() => {});
}

export async function isAvailable(): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1_000);
  try {
    const res = await fetch(`${BROWSER_URL}/healthz`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function getBrowserUrl(): string {
  return BROWSER_URL;
}
