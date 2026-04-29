"use client";

import { useEffect, useState } from "react";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };

export default function SandboxSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { codeSandboxEnabled?: boolean }) => {
        setEnabled(d.codeSandboxEnabled ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codeSandboxEnabled: !enabled }),
      });
      if (res.ok) setEnabled((v) => !v);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <span style={{ ...MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "var(--fg-3)" }}>
          settings · sandbox
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", margin: "8px 0 4px", color: "var(--fg-1)" }}>
          code sandbox
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
          allow the AI to run code in a subprocess on this machine. supports Python 3 and Node.js. executions are time-limited to 10 seconds with no network access.
        </p>
      </div>

      <div style={{ background: "var(--surface-1)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-3)", padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, color: "var(--fg-1)", marginBottom: 4 }}>code execution</div>
            <div style={{ ...MONO, fontSize: 11, color: "var(--fg-4)", lineHeight: 1.5 }}>
              {loading ? "loading…" : enabled
                ? "enabled — AI can run Python and JavaScript code"
                : "disabled — AI will not execute code"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={loading || saving}
            style={{
              ...MONO,
              background: enabled ? "color-mix(in oklch, var(--mint-400) 18%, transparent)" : "transparent",
              border: `1px solid ${enabled ? "var(--mint-400)" : "var(--stroke-1)"}`,
              borderRadius: "var(--r-2)",
              color: enabled ? "var(--mint-300)" : "var(--fg-3)",
              padding: "8px 20px",
              cursor: "pointer",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              transition: "all 120ms",
            }}
          >
            {saving ? "…" : enabled ? "enabled" : "disabled"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 20, padding: "14px 16px", background: "color-mix(in oklch, var(--signal-err) 8%, transparent)", border: "1px solid color-mix(in oklch, var(--signal-err) 25%, transparent)", borderRadius: "var(--r-2)" }}>
        <p style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: "var(--signal-err)" }}>security note:</strong> code runs as the same OS user as the server process. only enable on trusted local deployments. AI-generated code can read files, write to disk, and consume CPU. do not enable in multi-user or publicly accessible deployments.
        </p>
      </div>
    </div>
  );
}
