"use client";

import { useEffect, useState } from "react";

type Template = {
  id: string;
  name: string;
  body: string;
  emoji: string | null;
  shortcut: string | null;
  createdAt: string;
};

type Draft = { name: string; emoji: string; shortcut: string; body: string };
const EMPTY: Draft = { name: "", emoji: "", shortcut: "", body: "" };

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
const INPUT: React.CSSProperties = {
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

function variablesIn(body: string): string[] {
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.add(m[1]);
  return [...out];
}

export default function PromptsSettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/prompt-templates");
      const data = (await res.json()) as { templates: Template[] };
      setTemplates(data.templates);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function startNew() { setEditingId("__new__"); setDraft(EMPTY); setErr(null); }
  function startEdit(t: Template) {
    setEditingId(t.id);
    setDraft({
      name: t.name,
      emoji: t.emoji ?? "",
      shortcut: t.shortcut ?? "",
      body: t.body,
    });
    setErr(null);
  }

  async function save() {
    if (!draft.name.trim() || !draft.body.trim()) {
      setErr("Name and body are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const body = {
        name: draft.name.trim(),
        body: draft.body,
        emoji: draft.emoji.trim() || null,
        shortcut: draft.shortcut.trim() || null,
      };
      const isNew = editingId === "__new__";
      const res = await fetch(isNew ? "/api/prompt-templates" : `/api/prompt-templates/${editingId}`, {
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

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/prompt-templates/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Prompt library</h1>
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
            + new template
          </button>
        )}
      </div>
      <p style={{ color: "var(--fg-3)", marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
        Saved snippets you can drop into the composer. Use <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 2 }}>{`{{variable}}`}</code> placeholders that&rsquo;ll prompt for input. A shortcut like <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 2 }}>/summarize</code> lets you expand the template by typing it in chat.
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
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <span style={LABEL}>emoji</span>
              <input
                type="text"
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value.slice(0, 4) })}
                placeholder="📝"
                style={{ ...INPUT, textAlign: "center", fontSize: 18, padding: 6 }}
              />
            </div>
            <div>
              <span style={LABEL}>name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Summarize"
                style={INPUT}
              />
            </div>
            <div>
              <span style={LABEL}>shortcut (optional)</span>
              <input
                type="text"
                value={draft.shortcut}
                onChange={(e) => setDraft({ ...draft, shortcut: e.target.value })}
                placeholder="/summarize"
                style={{ ...INPUT, fontFamily: "var(--font-mono)" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={LABEL}>body</span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder={"Summarize this in 3 bullets:\n\n{{text}}"}
              rows={6}
              style={{ ...INPUT, fontFamily: "var(--font-mono)", resize: "vertical", minHeight: 120 }}
            />
            {variablesIn(draft.body).length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--fg-3)" }}>
                detected variables:{" "}
                {variablesIn(draft.body).map((v) => (
                  <code key={v} style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 2, marginRight: 4, fontFamily: "var(--font-mono)" }}>
                    {v}
                  </code>
                ))}
              </div>
            )}
          </div>
          {err && <div style={{ color: "var(--signal-err)", fontSize: 12, marginBottom: 10 }}>{err}</div>}
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
      ) : templates.length === 0 ? (
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
          No templates yet. Save snippets you reuse to expand them in any conversation.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {templates.map((t) => (
            <li
              key={t.id}
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-2)",
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: 22, lineHeight: 1, width: 30, textAlign: "center" }}>
                  {t.emoji ?? "·"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{t.name}</span>
                    {t.shortcut && (
                      <code style={{ ...MONO, fontSize: 11, color: "var(--fg-accent)", background: "var(--surface-2)", padding: "1px 6px", borderRadius: 2 }}>
                        {t.shortcut}
                      </code>
                    )}
                  </div>
                  <div style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 60, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.body}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    style={{ ...MONO, fontSize: 10, padding: "4px 8px", background: "transparent", color: "var(--fg-2)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-1)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
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
