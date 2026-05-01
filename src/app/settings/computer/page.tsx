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
const CARD: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--stroke-1)",
  borderRadius: "var(--r-3)",
  padding: "20px 24px",
  marginBottom: 16,
};

type StatusResult = { available?: boolean; configured?: boolean; os?: string; version?: string };
type OS = "macos" | "linux" | "windows";

const OS_LABELS: Record<OS, string> = { macos: "macOS", linux: "Linux", windows: "Windows" };

const DEPS: Record<OS, string> = {
  macos:   "brew install node cliclick",
  linux:   "sudo apt-get install -y nodejs npm xdotool scrot xclip imagemagick",
  windows: "# Node.js required — download from https://nodejs.org",
};

const RUN_CMD = (token: string) =>
  `AGENT_TOKEN=${token || "your-secret-token"} node openmlc-agent.js`;

const WIN_RUN_CMD = (token: string) =>
  `set AGENT_TOKEN=${token || "your-secret-token"} && node openmlc-agent.js`;

export default function ComputerAgentPage() {
  const [url, setUrl] = useState("http://host.docker.internal:3031");
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<StatusResult | null>(null);
  const [os, setOs] = useState<OS>("macos");
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

  const pillBtn = (active: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...MONO,
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        padding: "5px 12px",
        background: active ? "var(--fg-accent)" : "transparent",
        color: active ? "#FAFAF7" : "var(--fg-3)",
        border: `1px solid ${active ? "var(--fg-accent)" : "var(--stroke-1)"}`,
        borderRadius: "var(--r-1)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

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
          Let AI models control your host machine — screen, keyboard, mouse, files, and shell.
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
          <strong style={{ color: "var(--signal-err)" }}>security warning:</strong>{" "}
          this gives AI models full control of your computer. only enable in sessions you trust.
          always set an auth token.
        </p>
      </div>

      {/* ── Step 1: Setup ── */}
      <div style={CARD}>
        <div style={{ fontWeight: 500, color: "var(--fg-1)", marginBottom: 4 }}>step 1 — setup</div>
        <p style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", margin: "0 0 16px", lineHeight: 1.6 }}>
          Download the agent and run it on your host machine. Pick your OS:
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["macos", "linux", "windows"] as OS[]).map((o) => pillBtn(os === o, () => setOs(o), OS_LABELS[o]))}
        </div>

        {/* Download button */}
        <a
          href="/api/computer/agent"
          download="openmlc-agent.js"
          style={{
            ...MONO,
            display: "inline-block",
            background: "var(--fg-accent)",
            color: "#FAFAF7",
            border: "1px solid var(--fg-accent)",
            borderRadius: "var(--r-2)",
            padding: "8px 16px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          ↓ download openmlc-agent.js
        </a>

        {/* Deps */}
        <div style={{ marginBottom: 12 }}>
          <span style={LABEL}>1. install dependencies</span>
          <pre style={{
            ...MONO,
            background: "var(--bg-canvas)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-2)",
            padding: "10px 14px",
            fontSize: 11,
            color: "var(--fg-2)",
            margin: 0,
            overflowX: "auto",
          }}>
            {DEPS[os]}
          </pre>
        </div>

        {/* Run command */}
        <div>
          <span style={LABEL}>2. run the agent (keep this terminal open)</span>
          <pre style={{
            ...MONO,
            background: "var(--bg-canvas)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-2)",
            padding: "10px 14px",
            fontSize: 11,
            color: "var(--fg-2)",
            margin: 0,
            overflowX: "auto",
          }}>
            {os === "windows" ? WIN_RUN_CMD(token) : RUN_CMD(token)}
          </pre>
          <p style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 6, lineHeight: 1.6 }}>
            listens on <code>127.0.0.1:3031</code> · shell log at <code>~/.openmlc-agent/shell.log</code>
          </p>
        </div>
      </div>

      {/* ── Step 2: Connect ── */}
      <div style={CARD}>
        <div style={{ fontWeight: 500, color: "var(--fg-1)", marginBottom: 16 }}>step 2 — connect</div>

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
                Mac / Windows: <code>host.docker.internal</code> · Linux: <code>172.17.0.1</code> · no Docker: <code>localhost</code>
              </div>
            </div>

            <div>
              <span style={LABEL}>auth token {hasToken ? "(set — leave blank to keep)" : "(must match AGENT_TOKEN above)"}</span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={hasToken ? "••••••••" : "your-secret-token"}
                style={{ ...INPUT, fontFamily: "var(--font-mono)" }}
                autoComplete="off"
              />
            </div>

            {err && <div style={{ ...MONO, fontSize: 11, color: "var(--signal-err)" }}>{err}</div>}

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
                <span style={{ ...MONO, fontSize: 11, color: testResult.available ? "var(--green-500)" : "var(--signal-err)" }}>
                  {testResult.available
                    ? `connected${testResult.os ? ` — ${testResult.os}` : ""}${testResult.version ? ` v${testResult.version}` : ""}`
                    : testResult.configured ? "unreachable — is the agent running?"
                    : "not configured"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ ...MONO, fontSize: 11, color: "var(--fg-4)", lineHeight: 1.6 }}>
        once connected, enable computer mode using the pill button in the chat composer.
      </div>
    </div>
  );
}
