"use client";

import { useEffect, useState } from "react";

type ModelEntry = {
  providerModelId: string;
  name?: string;
  contextWindow?: number;
  vision?: boolean;
};

type CustomProvider = {
  id: string;
  name: string;
  baseUrl: string;
  models: string;
  enabled: boolean;
  hasKey: boolean;
};

type Draft = {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelsRaw: string;
};

const EMPTY: Draft = {
  name: "",
  baseUrl: "",
  apiKey: "",
  modelsRaw: "",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
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

function parseModelsLines(raw: string): ModelEntry[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [slug, ...rest] = line.split(/\s*[|│]\s*/);
      const labelPart = rest.join(" | ").trim();
      const ctxMatch = /(\d+)k\s*ctx/i.exec(labelPart);
      const visionFlag = /\bvision\b/i.test(labelPart);
      const cleanName = labelPart
        .replace(/\d+k\s*ctx/gi, "")
        .replace(/\bvision\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return {
        providerModelId: slug,
        name: cleanName || undefined,
        contextWindow: ctxMatch ? Number(ctxMatch[1]) * 1000 : undefined,
        vision: visionFlag || undefined,
      };
    });
}

function formatModelsLines(models: ModelEntry[]): string {
  return models
    .map((m) => {
      const parts: string[] = [m.providerModelId];
      const meta: string[] = [];
      if (m.name) meta.push(m.name);
      if (m.contextWindow) meta.push(`${Math.round(m.contextWindow / 1000)}k ctx`);
      if (m.vision) meta.push("vision");
      if (meta.length) parts.push(meta.join(" "));
      return parts.join(" | ");
    })
    .join("\n");
}

export default function CustomProvidersPage() {
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/custom-providers");
      const data = (await res.json()) as { providers: CustomProvider[] };
      setProviders(data.providers);
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

  function startEdit(p: CustomProvider) {
    setEditingId(p.id);
    let models: ModelEntry[] = [];
    try { models = JSON.parse(p.models) as ModelEntry[]; } catch {}
    setDraft({
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: "",
      modelsRaw: formatModelsLines(models),
    });
    setErr(null);
  }

  async function save() {
    if (!draft.name.trim() || !draft.baseUrl.trim() || !draft.modelsRaw.trim()) {
      setErr("Name, base URL, and at least one model are required.");
      return;
    }
    const models = parseModelsLines(draft.modelsRaw);
    if (models.length === 0) {
      setErr("At least one model slug is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const isNew = editingId === "__new__";
      const body: Record<string, unknown> = {
        name: draft.name.trim(),
        baseUrl: draft.baseUrl.trim(),
        models,
      };
      if (draft.apiKey) body.apiKey = draft.apiKey;
      const res = await fetch(isNew ? "/api/custom-providers" : `/api/custom-providers/${editingId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "save_failed");
      }
      setEditingId(null);
      setDraft(EMPTY);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this provider? Any conversations using its models will need a different model selected.")) return;
    await fetch(`/api/custom-providers/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleEnabled(p: CustomProvider) {
    await fetch(`/api/custom-providers/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    await load();
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Custom providers</h1>
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
            + add provider
          </button>
        )}
      </div>
      <p style={{ color: "var(--fg-3)", marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
        Hook up any OpenAI-compatible endpoint - Together, Groq, Anyscale, vLLM, LM Studio, LiteLLM, Mistral, Cerebras, your own deployment. Specify the model slugs the provider exposes; OpenMLC does not auto-discover.
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <span style={LABEL}>name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Together AI"
                style={INPUT}
              />
            </div>
            <div>
              <span style={LABEL}>base url</span>
              <input
                type="url"
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                placeholder="https://api.together.xyz/v1"
                style={{ ...INPUT, fontFamily: "var(--font-mono)" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={LABEL}>api key (leave blank for public endpoints)</span>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="sk-..."
              autoComplete="off"
              style={{ ...INPUT, fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={LABEL}>models (one per line - slug | display name 128k ctx vision)</span>
            <textarea
              value={draft.modelsRaw}
              onChange={(e) => setDraft({ ...draft, modelsRaw: e.target.value })}
              placeholder={`meta-llama/Llama-3.3-70B-Instruct-Turbo | Llama 3.3 70B 128k ctx
meta-llama/Llama-Vision-Free | Llama 3.2 11B Vision 128k ctx vision
mistralai/Mixtral-8x22B-Instruct-v0.1 | Mixtral 8x22B 64k ctx`}
              rows={7}
              style={{ ...INPUT, fontFamily: "var(--font-mono)", resize: "vertical", minHeight: 140 }}
            />
            <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 6, lineHeight: 1.6 }}>
              Format: <code>provider-model-slug | Display Name 128k ctx vision</code><br />
              Slug is what gets sent to the provider. Display name + tags are optional.
            </div>
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
              {saving ? "saving..." : "save"}
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
        <div style={{ color: "var(--fg-3)", fontSize: 13 }}>Loading...</div>
      ) : providers.length === 0 ? (
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
          No custom providers yet. Add one to wire up any OpenAI-compatible endpoint.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {providers.map((p) => {
            let modelsList: ModelEntry[] = [];
            try { modelsList = JSON.parse(p.models) as ModelEntry[]; } catch {}
            return (
              <li
                key={p.id}
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid",
                  borderColor: p.enabled ? "var(--stroke-1)" : "var(--stroke-1)",
                  borderRadius: "var(--r-2)",
                  padding: "12px 14px",
                  opacity: p.enabled ? 1 : 0.55,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{p.name}</span>
                      <span style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {modelsList.length} model{modelsList.length !== 1 ? "s" : ""}
                      </span>
                      {p.hasKey && (
                        <span style={{ ...MONO, fontSize: 9, color: "var(--green-500)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                          key set
                        </span>
                      )}
                    </div>
                    <div style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.baseUrl}
                    </div>
                    <div style={{ ...MONO, fontSize: 11, color: "var(--fg-4)", marginTop: 6, lineHeight: 1.6 }}>
                      {modelsList.slice(0, 3).map((m) => m.providerModelId).join(", ")}
                      {modelsList.length > 3 ? `, +${modelsList.length - 3} more` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      style={{ ...MONO, fontSize: 10, padding: "4px 8px", background: "transparent", color: "var(--fg-2)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-1)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEnabled(p)}
                      style={{ ...MONO, fontSize: 10, padding: "4px 8px", background: "transparent", color: p.enabled ? "var(--fg-2)" : "var(--green-500)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-1)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
                    >
                      {p.enabled ? "disable" : "enable"}
                    </button>
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
