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
  models: ModelEntry[];
};

const EMPTY: Draft = {
  name: "",
  baseUrl: "",
  apiKey: "",
  models: [],
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

function ModelRow({
  model,
  onChange,
  onRemove,
}: {
  model: ModelEntry;
  onChange: (m: ModelEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--bg-canvas)",
        border: "1px solid var(--stroke-1)",
        borderRadius: "var(--r-2)",
        padding: 10,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 110px 80px 32px",
        gap: 8,
        alignItems: "end",
      }}
    >
      <div>
        <span style={LABEL}>model slug</span>
        <input
          type="text"
          value={model.providerModelId}
          onChange={(e) => onChange({ ...model, providerModelId: e.target.value })}
          placeholder="meta-llama/Llama-3.3-70B-Instruct-Turbo"
          style={{ ...INPUT, fontFamily: "var(--font-mono)", fontSize: 12 }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div>
        <span style={LABEL}>display name</span>
        <input
          type="text"
          value={model.name ?? ""}
          onChange={(e) => onChange({ ...model, name: e.target.value || undefined })}
          placeholder="Llama 3.3 70B"
          style={INPUT}
        />
      </div>
      <div>
        <span style={LABEL}>context</span>
        <input
          type="number"
          min={1024}
          step={1024}
          value={model.contextWindow ?? ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ ...model, contextWindow: isFinite(n) && n > 0 ? n : undefined });
          }}
          placeholder="128000"
          style={{ ...INPUT, fontFamily: "var(--font-mono)" }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={LABEL}>vision</span>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            paddingTop: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!!model.vision}
            onChange={(e) => onChange({ ...model, vision: e.target.checked || undefined })}
          />
          <span style={{ ...MONO, fontSize: 11, color: "var(--fg-3)" }}>image input</span>
        </label>
      </div>
      <button
        type="button"
        onClick={onRemove}
        title="remove model"
        style={{
          width: 32,
          height: 32,
          padding: 0,
          background: "transparent",
          color: "var(--signal-err)",
          border: "1px solid var(--stroke-1)",
          borderRadius: "var(--r-1)",
          cursor: "pointer",
          fontSize: 16,
          marginBottom: 2,
        }}
      >
        ×
      </button>
    </div>
  );
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
    setDraft({ ...EMPTY, models: [{ providerModelId: "" }] });
    setErr(null);
  }

  function startEdit(p: CustomProvider) {
    setEditingId(p.id);
    let models: ModelEntry[] = [];
    try { models = JSON.parse(p.models) as ModelEntry[]; } catch {}
    if (models.length === 0) models = [{ providerModelId: "" }];
    setDraft({
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: "",
      models,
    });
    setErr(null);
  }

  function setModel(idx: number, m: ModelEntry) {
    setDraft((prev) => ({
      ...prev,
      models: prev.models.map((x, i) => (i === idx ? m : x)),
    }));
  }

  function addModel() {
    setDraft((prev) => ({ ...prev, models: [...prev.models, { providerModelId: "" }] }));
  }

  function removeModel(idx: number) {
    setDraft((prev) => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== idx),
    }));
  }

  async function save() {
    if (!draft.name.trim() || !draft.baseUrl.trim()) {
      setErr("Name and base URL are required.");
      return;
    }
    const cleanedModels = draft.models
      .map((m) => ({
        ...m,
        providerModelId: m.providerModelId.trim(),
        name: m.name?.trim() || undefined,
      }))
      .filter((m) => m.providerModelId.length > 0);
    if (cleanedModels.length === 0) {
      setErr("Add at least one model.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const isNew = editingId === "__new__";
      const body: Record<string, unknown> = {
        name: draft.name.trim(),
        baseUrl: draft.baseUrl.trim(),
        models: cleanedModels,
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
    if (!confirm("Delete this provider? Conversations using its models will need a different model selected.")) return;
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
    <div style={{ maxWidth: 920 }}>
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
        Connect any OpenAI-compatible endpoint - Together, Groq, Anyscale, vLLM, LM Studio, LiteLLM, your own deployment. List the model slugs the provider exposes.
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
          <div style={{ marginBottom: 16 }}>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={LABEL}>models</span>
              <button
                type="button"
                onClick={addModel}
                style={{
                  ...MONO,
                  fontSize: 10,
                  padding: "5px 10px",
                  background: "transparent",
                  color: "var(--fg-2)",
                  border: "1px solid var(--stroke-1)",
                  borderRadius: "var(--r-1)",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                + add model
              </button>
            </div>
            {draft.models.length === 0 ? (
              <div
                style={{
                  border: "1px dashed var(--stroke-1)",
                  borderRadius: "var(--r-2)",
                  padding: 16,
                  textAlign: "center",
                  color: "var(--fg-3)",
                  fontSize: 12,
                }}
              >
                No models yet - click &ldquo;+ add model&rdquo;
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {draft.models.map((m, i) => (
                  <ModelRow
                    key={i}
                    model={m}
                    onChange={(next) => setModel(i, next)}
                    onRemove={() => removeModel(i)}
                  />
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
                  border: "1px solid var(--stroke-1)",
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
