"use client";

import { useEffect, useState } from "react";

type Item = {
  provider: "openai" | "anthropic" | "google" | "xai" | "fireworks" | "openrouter" | "ollama";
  hasKey: boolean;
  masked: string | null;
  baseUrl: string | null;
  envFallback: boolean;
  source: "byok" | "env" | null;
  createdAt: string | null;
};

const PROVIDER_LABEL: Record<Item["provider"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  fireworks: "Fireworks",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
};

const PROVIDER_HINT: Record<Item["provider"], string> = {
  openai: "starts with sk-",
  anthropic: "starts with sk-ant-",
  google: "google ai studio key",
  xai: "starts with xai-",
  fireworks: "starts with fw_",
  openrouter: "starts with sk-or-",
  ollama: "no key needed — just the base url",
};

const PROVIDER_DOT: Record<Item["provider"], string> = {
  openai: "var(--mint-400)",
  anthropic: "#cd7f32",
  google: "var(--cyan-500)",
  xai: "var(--fg-2)",
  fireworks: "#ff6b35",
  openrouter: "#a78bfa",
  ollama: "var(--fg-3)",
};

export function ApiKeysManager() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [byokAvailable, setByokAvailable] = useState(true);

  async function load() {
    const res = await fetch("/api/api-keys");
    const data = await res.json();
    setItems(data.items ?? []);
    setByokAvailable(data.byokAvailable ?? true);
  }

  useEffect(() => {
    load();
  }, []);

  if (!items) {
    return <div style={{ color: "var(--fg-3)", fontSize: 13 }}>loading…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!byokAvailable && (
        <div
          style={{
            padding: "10px 14px",
            border: "1px solid color-mix(in oklch, var(--signal-warn) 40%, transparent)",
            background: "color-mix(in oklch, var(--signal-warn) 8%, transparent)",
            borderRadius: 8,
            color: "var(--signal-warn)",
            fontSize: 13,
          }}
        >
          ENCRYPTION_KEY is not set in <code>.env</code>. Per-profile keys are disabled until you set
          a 64-char hex string. <code style={{ fontFamily: "var(--font-mono)" }}>openssl rand -hex 32</code>
        </div>
      )}
      {items.map((item) => (
        <KeyCard key={item.provider} item={item} onChange={load} disabled={!byokAvailable} />
      ))}
    </div>
  );
}

function KeyCard({ item, onChange, disabled }: { item: Item; onChange: () => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [baseUrl, setBaseUrl] = useState(item.baseUrl ?? (item.provider === "ollama" ? "http://localhost:11434/v1" : ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isOllama = item.provider === "ollama";

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, string | undefined> = { provider: item.provider };
      if (keyValue.trim()) body.key = keyValue.trim();
      if (isOllama) body.baseUrl = baseUrl.trim() || "http://localhost:11434/v1";
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? "save failed");
      setKeyValue("");
      setEditing(false);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`remove ${PROVIDER_LABEL[item.provider]} key?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/api-keys/${item.provider}`, { method: "DELETE" });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--stroke-1)",
        borderRadius: 12,
        padding: 16,
        background: "var(--surface-1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: PROVIDER_DOT[item.provider] }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)" }}>{PROVIDER_LABEL[item.provider]}</span>
        {item.source && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: 3,
              border: "1px solid var(--stroke-2)",
              background: item.source === "byok" ? "rgba(30,131,238,0.08)" : "var(--surface-2)",
              color: item.source === "byok" ? "var(--cyan-300)" : "var(--fg-3)",
              borderColor: item.source === "byok" ? "rgba(30,131,238,0.4)" : "var(--stroke-2)",
            }}
          >
            {item.source}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
          {item.hasKey
            ? isOllama
              ? item.baseUrl ?? "—"
              : item.masked ?? "set"
            : item.envFallback
              ? "using .env fallback"
              : "no key"}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 12px 18px" }}>{PROVIDER_HINT[item.provider]}</p>

      {!editing && (
        <div style={{ display: "flex", gap: 8, marginLeft: 18 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={disabled || busy}
            className="tool-pill"
          >
            {item.hasKey ? "update" : "add key"}
          </button>
          {item.hasKey && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="tool-pill"
              style={{ color: "var(--signal-err)" }}
            >
              remove
            </button>
          )}
        </div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 18 }}>
          {isOllama && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>
                base url
              </span>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                style={inputStyle}
              />
            </label>
          )}
          {!isOllama && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>
                api key
              </span>
              <input
                autoFocus
                type="password"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder="paste key…"
                style={inputStyle}
              />
            </label>
          )}
          {err && (
            <p style={{ color: "var(--signal-err)", fontSize: 12 }}>· {err}</p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={save}
              disabled={busy || (!isOllama && !keyValue.trim())}
              className="new-chat"
              style={{ margin: 0, padding: "8px 14px", fontSize: 12 }}
            >
              {busy ? "saving…" : "save"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setKeyValue(""); setErr(null); }}
              className="tool-pill"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-canvas)",
  border: "1px solid var(--stroke-1)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--fg-1)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  outline: "none",
};
