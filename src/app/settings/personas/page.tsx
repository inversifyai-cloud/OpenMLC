"use client";

import { useEffect, useState } from "react";

type Persona = {
  id: string;
  name: string;
  emoji: string | null;
  systemPrompt: string;
  description: string | null;
  defaultModel: string | null;
  toolsEnabled: string | null;
  isDefault: boolean;
  createdAt: string;
};

type Draft = {
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
};

const EMPTY: Draft = { name: "", emoji: "", description: "", systemPrompt: "" };

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };
const LABEL: React.CSSProperties = {
  ...MONO,
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fg-3)",
  marginBottom: 6,
  display: "block",
};

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "var(--surface-1)",
    border: "1px solid var(--stroke-1)",
    borderRadius: "var(--r-2)",
    color: "var(--fg-1)",
    padding: "8px 10px",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };
}

export default function PersonasSettingsPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/personas");
      const data = (await res.json()) as { personas: Persona[] };
      setPersonas(data.personas);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function startNew() {
    setEditingId("__new__");
    setDraft(EMPTY);
    setErr(null);
  }

  function startEdit(p: Persona) {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      emoji: p.emoji ?? "",
      description: p.description ?? "",
      systemPrompt: p.systemPrompt,
    });
    setErr(null);
  }

  async function save() {
    if (!draft.name.trim() || !draft.systemPrompt.trim()) {
      setErr("Name and system prompt are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const body = {
        name: draft.name.trim(),
        emoji: draft.emoji.trim() || null,
        description: draft.description.trim() || null,
        systemPrompt: draft.systemPrompt,
      };
      const isNew = editingId === "__new__";
      const res = await fetch(isNew ? "/api/personas" : `/api/personas/${editingId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Save failed");
      }
      setEditingId(null);
      setDraft(EMPTY);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    await fetch(`/api/personas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this persona?")) return;
    await fetch(`/api/personas/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Personas</h1>
        {!editingId && (
          <button
            type="button"
            onClick={startNew}
            style={{
              background: "var(--fg-accent)",
              color: "#FAFAF7",
              border: "1px solid var(--fg-accent)",
              borderRadius: "var(--r-2)",
              padding: "6px 14px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            + new persona
          </button>
        )}
      </div>
      <p style={{ color: "var(--fg-3)", marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
        Saved system prompts you can pick per-conversation. Mark one as default to use it for every new chat.
      </p>

      {editingId && (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-3)",
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <span style={LABEL}>emoji</span>
              <input
                type="text"
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value.slice(0, 4) })}
                placeholder="🧑‍💻"
                style={{ ...inputStyle(), textAlign: "center", fontSize: 18, padding: 6 }}
              />
            </div>
            <div>
              <span style={LABEL}>name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Code Reviewer"
                style={inputStyle()}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={LABEL}>description (optional)</span>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Tough but fair PR review."
              style={inputStyle()}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={LABEL}>system prompt</span>
            <textarea
              value={draft.systemPrompt}
              onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              placeholder="You are a code reviewer. Be direct. Point out bugs, edge cases, and design issues."
              rows={6}
              style={{ ...inputStyle(), fontFamily: "var(--font-mono)", resize: "vertical", minHeight: 120 }}
            />
          </div>
          {err && (
            <div style={{ color: "var(--signal-err)", fontSize: 12, marginBottom: 10 }}>{err}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                background: "var(--fg-accent)",
                color: "#FAFAF7",
                border: "1px solid var(--fg-accent)",
                borderRadius: "var(--r-2)",
                padding: "7px 14px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "saving…" : "save"}
            </button>
            <button
              type="button"
              onClick={() => { setEditingId(null); setDraft(EMPTY); setErr(null); }}
              style={{
                background: "transparent",
                color: "var(--fg-2)",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-2)",
                padding: "7px 14px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
              }}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--fg-3)", fontSize: 13 }}>Loading…</div>
      ) : personas.length === 0 ? (
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
          No personas yet. Create one to switch between system prompts per-conversation.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {personas.map((p) => (
            <li
              key={p.id}
              style={{
                background: "var(--surface-1)",
                border: "1px solid",
                borderColor: p.isDefault ? "var(--fg-accent)" : "var(--stroke-1)",
                borderRadius: "var(--r-2)",
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: 22, lineHeight: 1, width: 30, textAlign: "center" }}>
                  {p.emoji ?? "·"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{p.name}</span>
                    {p.isDefault && (
                      <span style={{ ...MONO, fontSize: 9, color: "var(--fg-accent)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                        default
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <div style={{ fontSize: 12, color: "var(--fg-3)", marginBottom: 4 }}>{p.description}</div>
                  )}
                  <div style={{ ...MONO, fontSize: 11, color: "var(--fg-4)", whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.systemPrompt}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    style={{ ...MONO, fontSize: 10, padding: "4px 8px", background: "transparent", color: "var(--fg-2)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-1)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
                  >
                    edit
                  </button>
                  {!p.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefault(p.id)}
                      style={{ ...MONO, fontSize: 10, padding: "4px 8px", background: "transparent", color: "var(--fg-2)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-1)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
                    >
                      default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    style={{ ...MONO, fontSize: 10, padding: "4px 8px", background: "transparent", color: "var(--signal-err)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-1)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
                  >
                    delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
