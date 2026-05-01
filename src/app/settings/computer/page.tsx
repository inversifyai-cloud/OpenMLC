"use client";

import { useEffect, useState } from "react";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };
const LABEL: React.CSSProperties = {
  ...MONO,
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "var(--fg-3)",
  marginBottom: 6,
  display: "block",
};
const INPUT: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-1)",
  border: "1px solid var(--stroke-1)",
  borderRadius: "var(--r-2)",
  color: "var(--fg-1)",
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box" as const,
};

type StatusResult = {
  available?: boolean;
  configured?: boolean;
  os?: string;
  version?: string;
};

type Tab = "macos" | "linux";

const MACOS_INSTRUCTIONS = `# 1. Install dependencies
brew install cliclick node

# 2. Clone and build the agent
git clone https://github.com/inversifyai-cloud/OpenMLC.git
cd OpenMLC/packages/openmlc-agent
npm install && npm run build

# 3. Start the agent (keep this terminal open)
AGENT_TOKEN=your-secret-token node dist/index.js

# The agent listens on http://127.0.0.1:3031 by default.`;

const LINUX_INSTRUCTIONS = `# 1. Install dependencies
sudo apt-get install -y xdotool scrot xclip imagemagick nodejs npm

# 2. Clone and build the agent
git clone https://github.com/inversifyai-cloud/OpenMLC.git
cd OpenMLC/packages/openmlc-agent
npm install && npm run build

# 3. Start the agent (keep this terminal open)
AGENT_TOKEN=your-secret-token node dist/index.js

# The agent listens on http://127.0.0.1:3031 by default.`;

export default function ComputerAgentPage() {
  const [url, setUrl] = useState("http://host.docker.internal:3031");
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<StatusResult | null>(null);
  const [tab, setTab] = useState<Tab>("macos");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { computerAgentUrl?: string | null; hasComputerAgentToken?: boolean }) => {
        if (d.computerAgentUrl) setUrl(d.computerAgentUrl);
        setHasToken(!!d.hasComputerAgentToken);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, string | null> = { computerAgentUrl: url };
      if (token) body.computerAgentToken = token;
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");
      const d = (await res.json()) as { hasComputerAgentToken?: boolean };
      setHasToken(!!d.hasComputerAgentToken);
      setToken("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/computer/status");
      const d = (await res.json()) as StatusResult;
      setTestResult(d);
    } catch {
      setTestResult({ available: false, configured: true });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <span style={{ ...MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "var(--fg-3)" }}>
          settings · computer agent
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", margin: "8px 0 4px", color: "var(--fg-1)" }}>
          computer agent
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
          Let AI models control your computer — screen, keyboard, mouse, files, and shell.
          Requires the <code style={MONO}>openmlc-agent</code> daemon running on your host machine.
        </p>
      </div>

      {/* Security warning */}
      <div style={{
        padding: "12px 16px",
        background: "color-mix(in oklch, var(--signal-err) 8%, transparent)",
        border: "1px solid color-mix(in oklch, var(--signal-err) 25%, transparent)",
        borderRadius: "var(--r-2)",
        marginBottom: 24,
      }}>
        <p style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: "var(--signal-err)" }}>security warning:</strong> this gives AI models full control of your computer including screen capture, file access, and shell execution. only enable computer mode in conversations you trust. set an agent token to prevent unauthorized access.
        </p>
      </div>

      {/* Connection settings */}
      <div style={{
        background: "var(--surface-1)",
        border: "1px solid var(--stroke-1)",
        borderRadius: "var(--r-3)",
        padding: "20px 24px",
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 500, color: "var(--fg-1)", marginBottom: 16 }}>connection</div>

        {loading ? (
          <div style={{ color: "var(--fg-3)", fontSize: 13 }}>loading…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <span style={LABEL}>agent url</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://host.docker.internal:3031"
                style={{ ...INPUT, fontFamily: "var(--font-mono)" }}
                autoComplete="off"
                spellCheck={false}
              />
              <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 4 }}>
                Mac: host.docker.internal · Linux self-hosted: 172.17.0.1 · Running locally: localhost
              </div>
            </div>

            <div>
              <span style={LABEL}>auth token {hasToken ? "(set — leave blank to keep)" : "(optional but recommended)"}</span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={hasToken ? "••••••••" : "your-secret-token"}
                style={{ ...INPUT, fontFamily: "var(--font-mono)" }}
                autoComplete="off"
              />
            </div>

            {err && (
              <div style={{ ...MONO, fontSize: 11, color: "var(--signal-err)" }}>{err}</div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !url.trim()}
                style={{
                  ...MONO,
                  background: "var(--fg-accent)",
                  color: "#FAFAF7",
                  border: "1px solid var(--fg-accent)",
                  borderRadius: "var(--r-2)",
                  padding: "7px 14px",
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? "saving…" : "save"}
              </button>

              <button
                type="button"
                onClick={() => void testConnection()}
                disabled={testing}
                style={{
                  ...MONO,
                  background: "transparent",
                  color: "var(--fg-2)",
                  border: "1px solid var(--stroke-1)",
                  borderRadius: "var(--r-2)",
                  padding: "7px 14px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  cursor: testing ? "not-allowed" : "pointer",
                  opacity: testing ? 0.5 : 1,
                }}
              >
                {testing ? "testing…" : "test connection"}
              </button>

              {testResult !== null && (
                <span style={{
                  ...MONO,
                  fontSize: 11,
                  color: testResult.available ? "var(--green-500)" : "var(--signal-err)",
                }}>
                  {testResult.available
                    ? `connected${testResult.os ? ` — ${testResult.os}` : ""}${testResult.version ? ` ${testResult.version}` : ""}`
                    : testResult.configured ? "unreachable — is the agent running?"
                    : "not configured"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Install instructions */}
      <div style={{
        background: "var(--surface-1)",
        border: "1px solid var(--stroke-1)",
        borderRadius: "var(--r-3)",
        padding: "20px 24px",
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 500, color: "var(--fg-1)", marginBottom: 16 }}>install openmlc-agent</div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["macos", "linux"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                padding: "5px 10px",
                background: tab === t ? "var(--fg-accent)" : "transparent",
                color: tab === t ? "#FAFAF7" : "var(--fg-3)",
                border: `1px solid ${tab === t ? "var(--fg-accent)" : "var(--stroke-1)"}`,
                borderRadius: "var(--r-1)",
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <pre style={{
          ...MONO,
          background: "var(--bg-canvas)",
          border: "1px solid var(--stroke-1)",
          borderRadius: "var(--r-2)",
          padding: "14px 16px",
          fontSize: 11,
          color: "var(--fg-2)",
          overflowX: "auto",
          lineHeight: 1.7,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}>
          {tab === "macos" ? MACOS_INSTRUCTIONS : LINUX_INSTRUCTIONS}
        </pre>

        <p style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 10, lineHeight: 1.6 }}>
          Shell commands are logged to <code>~/.openmlc-agent/shell.log</code> on the host.
          File access is restricted to paths configured in <code>~/.openmlc-agent/config.json</code> (default: your home directory).
        </p>
      </div>

      <div style={{ ...MONO, fontSize: 11, color: "var(--fg-4)", lineHeight: 1.6 }}>
        once configured, enable computer mode using the pill button in the chat composer.
      </div>
    </div>
  );
}
