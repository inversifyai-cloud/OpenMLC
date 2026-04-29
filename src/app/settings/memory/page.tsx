"use client";

import { useEffect, useState } from "react";

type MemoryRow = {
  id: string;
  text: string;
  source: string;
  pinned: boolean;
  active: boolean;
  sourceConvId: string | null;
  createdAt: string;
};

type Prefs = { memoryAutoExtract: boolean; memoryUseInContext: boolean };

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

export default function MemorySettingsPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ memoryAutoExtract: true, memoryUseInContext: true });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/memory");
      const data = (await res.json()) as { memories: MemoryRow[]; prefs: Prefs };
      setMemories(data.memories);
      setPrefs(data.prefs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function setPref(key: keyof Prefs, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
    await fetch("/api/memory", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  }

  async function addMemory() {
    const text = adding.trim();
    if (text.length < 2) return;
    setSaving(true);
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setAdding("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function update(id: string, patch: Partial<MemoryRow>) {
    setMemories((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await fetch(`/api/memory/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function remove(id: string) {
    setMemories((rows) => rows.filter((r) => r.id !== id));
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
  }

  async function forgetAll() {
    if (!confirm("Forget every memory? This cannot be undone.")) return;
    await fetch("/api/memory", { method: "DELETE" });
    await load();
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Memory</h1>
      <p style={{ color: "var(--fg-3)", marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
        Things OpenMLC remembers about you across all conversations. Auto-extracted from chats and used as context when relevant.
      </p>

      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--stroke-1)",
          borderRadius: "var(--r-3)",
          padding: 16,
          marginBottom: 24,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={prefs.memoryAutoExtract}
            onChange={(e) => setPref("memoryAutoExtract", e.target.checked)}
          />
          <span>
            <span style={{ fontSize: 13, color: "var(--fg-1)" }}>Auto-extract memories</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--fg-3)" }}>
              After each conversation, extract durable facts about you (uses your OpenAI key).
            </span>
          </span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={prefs.memoryUseInContext}
            onChange={(e) => setPref("memoryUseInContext", e.target.checked)}
          />
          <span>
            <span style={{ fontSize: 13, color: "var(--fg-1)" }}>Use memories in chat context</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--fg-3)" }}>
              Inject relevant memories into the system prompt at the start of each turn.
            </span>
          </span>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            ...MONO,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
            marginBottom: 8,
          }}
        >
          add memory
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMemory()}
            placeholder="e.g. User prefers TypeScript over JavaScript"
            style={{
              flex: 1,
              background: "var(--surface-1)",
              border: "1px solid var(--stroke-1)",
              borderRadius: "var(--r-2)",
              color: "var(--fg-1)",
              padding: "9px 12px",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={addMemory}
            disabled={saving || adding.trim().length < 2}
            style={{
              background: "var(--fg-accent)",
              color: "#FAFAF7",
              border: "1px solid var(--fg-accent)",
              borderRadius: "var(--r-2)",
              padding: "0 16px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? "adding…" : "add"}
          </button>
        </div>
      </div>

      <div
        style={{
          ...MONO,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
          marginBottom: 8,
          marginTop: 24,
        }}
      >
        {memories.length} {memories.length === 1 ? "memory" : "memories"}
      </div>

      {loading ? (
        <div style={{ color: "var(--fg-3)", fontSize: 13 }}>Loading…</div>
      ) : memories.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--stroke-1)",
            borderRadius: "var(--r-3)",
            padding: 32,
            textAlign: "center",
            color: "var(--fg-3)",
            fontSize: 13,
          }}
        >
          No memories yet. They&rsquo;ll appear here after a few conversations.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {memories.map((m) => (
            <li
              key={m.id}
              style={{
                background: m.active ? "var(--surface-1)" : "transparent",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-2)",
                padding: "12px 14px",
                opacity: m.active ? 1 : 0.55,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, fontSize: 13, lineHeight: 1.55, color: "var(--fg-1)" }}>{m.text}</div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => update(m.id, { pinned: !m.pinned })}
                    title={m.pinned ? "unpin" : "pin (always include)"}
                    style={{
                      background: m.pinned ? "var(--fg-accent)" : "transparent",
                      color: m.pinned ? "#FAFAF7" : "var(--fg-3)",
                      border: "1px solid",
                      borderColor: m.pinned ? "var(--fg-accent)" : "var(--stroke-1)",
                      borderRadius: "var(--r-1)",
                      width: 26,
                      height: 26,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    📌
                  </button>
                  <button
                    type="button"
                    onClick={() => update(m.id, { active: !m.active })}
                    title={m.active ? "disable" : "enable"}
                    style={{
                      background: "transparent",
                      color: "var(--fg-3)",
                      border: "1px solid var(--stroke-1)",
                      borderRadius: "var(--r-1)",
                      width: 26,
                      height: 26,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {m.active ? "✓" : "·"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    title="delete"
                    style={{
                      background: "transparent",
                      color: "var(--signal-err)",
                      border: "1px solid var(--stroke-1)",
                      borderRadius: "var(--r-1)",
                      width: 26,
                      height: 26,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 6, letterSpacing: "0.04em" }}>
                {m.source} · {relTime(m.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {memories.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <button
            type="button"
            onClick={forgetAll}
            style={{
              background: "transparent",
              color: "var(--signal-err)",
              border: "1px solid var(--signal-err)",
              borderRadius: "var(--r-2)",
              padding: "8px 14px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            forget everything
          </button>
        </div>
      )}
    </div>
  );
}
