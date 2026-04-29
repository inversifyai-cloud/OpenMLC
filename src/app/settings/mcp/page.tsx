"use client";

import { useEffect, useState } from "react";

type McpServer = {
  id: string;
  name: string;
  command: string;
  args: string;
  env: string;
  enabled: boolean;
};

function parseArgs(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function parseEnv(raw: string): Record<string, string> {
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };
const LABEL: React.CSSProperties = { ...MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--fg-3)", marginBottom: 6, display: "block" };

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={LABEL}>{label}</span>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        background: "var(--surface-1)",
        border: "1px solid var(--stroke-1)",
        borderRadius: "var(--r-2)",
        color: "var(--fg-1)",
        padding: "7px 10px",
        fontSize: 13,
        fontFamily: mono ? "var(--font-mono)" : undefined,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

export default function McpSettingsPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", command: "", argsRaw: "", envRaw: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/mcp");
      const data = await res.json() as { servers: McpServer[] };
      setServers(data.servers);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function addServer() {
    setSaving(true);
    setErr(null);
    try {
      let args: string[] = [];
      let env: Record<string, string> = {};
      try { args = form.argsRaw ? JSON.parse(form.argsRaw) as string[] : []; } catch { setErr("args must be valid JSON array e.g. [\"arg1\"]"); return; }
      try { env = form.envRaw ? JSON.parse(form.envRaw) as Record<string, string> : {}; } catch { setErr("env must be valid JSON object e.g. {\"KEY\": \"value\"}"); return; }
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, command: form.command, args, env }),
      });
      if (!res.ok) { setErr("failed to add server"); return; }
      setForm({ name: "", command: "", argsRaw: "", envRaw: "" });
      setAdding(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleServer(id: string, enabled: boolean) {
    await fetch(`/api/mcp/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setServers((prev) => prev.map((s) => s.id === id ? { ...s, enabled } : s));
  }

  async function deleteServer(id: string) {
    if (!confirm("Remove this MCP server?")) return;
    await fetch(`/api/mcp/${id}`, { method: "DELETE" });
    setServers((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <span style={{ ...MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-3)" }}>
          settings · mcp
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", margin: "8px 0 4px", color: "var(--fg-1)" }}>
          mcp servers
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5, marginBottom: 0 }}>
          connect Model Context Protocol servers to expose their tools in chat. each server runs as a subprocess.
        </p>
      </div>

      {loading && (
        <p style={{ ...MONO, color: "var(--fg-4)" }}>loading…</p>
      )}

      {!loading && servers.length === 0 && !adding && (
        <div style={{ border: "1px dashed var(--stroke-1)", borderRadius: "var(--r-3)", padding: "32px 24px", textAlign: "center", color: "var(--fg-4)" }}>
          <p style={{ ...MONO, fontSize: 12, margin: "0 0 16px" }}>no mcp servers configured</p>
          <button type="button" className="send-btn" style={{ width: "auto", padding: "0 20px" }} onClick={() => setAdding(true)}>
            + add server
          </button>
        </div>
      )}

      {servers.map((s) => {
        const args = parseArgs(s.args);
        const env = parseEnv(s.env);
        const envKeys = Object.keys(env);
        return (
          <div
            key={s.id}
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--stroke-1)",
              borderRadius: "var(--r-3)",
              padding: "14px 16px",
              marginBottom: 12,
              opacity: s.enabled ? 1 : 0.55,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontWeight: 500, color: "var(--fg-1)", fontSize: 14 }}>{s.name}</span>
              <span style={{ ...MONO, fontSize: 10, color: s.enabled ? "var(--mint-300)" : "var(--fg-4)", marginLeft: "auto" }}>
                {s.enabled ? "enabled" : "disabled"}
              </span>
              <button
                type="button"
                onClick={() => void toggleServer(s.id, !s.enabled)}
                style={{ ...MONO, background: "transparent", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-1)", color: "var(--fg-3)", padding: "2px 8px", cursor: "pointer", fontSize: 10 }}
              >
                {s.enabled ? "disable" : "enable"}
              </button>
              <button
                type="button"
                onClick={() => void deleteServer(s.id)}
                style={{ ...MONO, background: "transparent", border: "1px solid color-mix(in oklch, var(--signal-err) 40%, transparent)", borderRadius: "var(--r-1)", color: "var(--signal-err)", padding: "2px 8px", cursor: "pointer", fontSize: 10 }}
              >
                remove
              </button>
            </div>
            <div style={{ ...MONO, color: "var(--fg-3)", fontSize: 12 }}>
              <span style={{ color: "var(--fg-accent)" }}>{s.command}</span>{" "}
              {args.join(" ")}
            </div>
            {envKeys.length > 0 && (
              <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 4 }}>
                env: {envKeys.join(", ")}
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--stroke-focus)", borderRadius: "var(--r-3)", padding: "20px" }}>
          <div style={{ ...MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-accent)", marginBottom: 16 }}>
            new mcp server
          </div>
          <SettingRow label="name">
            <TextInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="my-mcp-server" />
          </SettingRow>
          <SettingRow label="command">
            <TextInput value={form.command} onChange={(v) => setForm((f) => ({ ...f, command: v }))} placeholder="npx" mono />
          </SettingRow>
          <SettingRow label={`args (JSON array)`}>
            <TextInput value={form.argsRaw} onChange={(v) => setForm((f) => ({ ...f, argsRaw: v }))} placeholder='["-y", "@my/mcp-server"]' mono />
          </SettingRow>
          <SettingRow label={`env vars (JSON object, optional)`}>
            <TextInput value={form.envRaw} onChange={(v) => setForm((f) => ({ ...f, envRaw: v }))} placeholder='{"API_KEY": "sk-..."}' mono />
          </SettingRow>
          {err && <p style={{ color: "var(--signal-err)", ...MONO, fontSize: 12, marginBottom: 12 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="send-btn"
              style={{ width: "auto", padding: "0 20px" }}
              disabled={!form.name || !form.command || saving}
              onClick={() => void addServer()}
            >
              {saving ? "adding…" : "add server"}
            </button>
            <button
              type="button"
              style={{ ...MONO, background: "transparent", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-2)", color: "var(--fg-3)", padding: "6px 16px", cursor: "pointer", fontSize: 12 }}
              onClick={() => { setAdding(false); setErr(null); }}
            >
              cancel
            </button>
          </div>
        </div>
      ) : (
        servers.length > 0 && (
          <button type="button" className="send-btn" style={{ width: "auto", padding: "0 20px", marginTop: 8 }} onClick={() => setAdding(true)}>
            + add server
          </button>
        )
      )}

      <div style={{ marginTop: 32, padding: "16px", background: "var(--surface-1)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-3)" }}>
        <p style={{ ...MONO, fontSize: 11, color: "var(--fg-4)", margin: 0, lineHeight: 1.6 }}>
          mcp tools are automatically prefixed <code style={{ color: "var(--fg-accent)" }}>mcp__server-name__tool-name</code> and appear inline in chat like any other tool. tools from enabled servers are always active when using models with tool support.
        </p>
      </div>
    </div>
  );
}
