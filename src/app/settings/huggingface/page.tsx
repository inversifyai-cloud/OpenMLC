"use client";

import { useEffect, useState } from "react";

// HF endpoints are stored as CustomProvider entries tagged with __hf: true
// in the models JSON so we can filter them here without a separate DB table.

type HFEndpoint = {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  hasToken: boolean;
  enabled: boolean;
};

type RawProvider = {
  id: string;
  name: string;
  baseUrl: string;
  models: string;
  hasKey: boolean;
  enabled: boolean;
};

type TestResult = {
  ok: boolean;
  baseUrl?: string;
  modelId?: string | null;
  models?: string[];
  error?: string;
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

function isHFProvider(raw: RawProvider): boolean {
  try {
    const models = JSON.parse(raw.models) as Array<{ __hf?: boolean }>;
    return models.length > 0 && models[0].__hf === true;
  } catch {
    return false;
  }
}

function toHFEndpoint(raw: RawProvider): HFEndpoint {
  let modelId = "";
  try {
    const models = JSON.parse(raw.models) as Array<{ providerModelId?: string }>;
    modelId = models[0]?.providerModelId ?? "";
  } catch {}
  return {
    id: raw.id,
    name: raw.name,
    baseUrl: raw.baseUrl,
    modelId,
    hasToken: raw.hasKey,
    enabled: raw.enabled,
  };
}

export default function HuggingFacePage() {
  const [endpoints, setEndpoints] = useState<HFEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [modelId, setModelId] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/custom-providers");
      const data = (await res.json()) as { providers: RawProvider[] };
      setEndpoints(
        (data.providers ?? []).filter(isHFProvider).map(toHFEndpoint)
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openForm() {
    setUrl("");
    setToken("");
    setDisplayName("");
    setModelId("");
    setTestResult(null);
    setErr(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setTestResult(null);
    setErr(null);
  }

  async function testConnection() {
    setErr(null);
    setTestResult(null);
    setTesting(true);
    try {
      const res = await fetch("/api/huggingface/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), token: token.trim() }),
      });
      const data = (await res.json()) as TestResult;
      setTestResult(data);
      if (data.ok) {
        // Auto-fill model ID and display name if empty
        if (data.modelId && !modelId) setModelId(data.modelId);
        if (data.modelId && !displayName) {
          // Use the last part of the model path as display name
          setDisplayName(data.modelId.split("/").pop() ?? data.modelId);
        }
        if (data.baseUrl && !url.endsWith("/v1")) setUrl(data.baseUrl);
      }
    } catch {
      setTestResult({ ok: false, error: "network error" });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    const trimmedUrl = url.trim();
    const trimmedModelId = modelId.trim();
    const trimmedName = displayName.trim() || trimmedModelId.split("/").pop() || "HF Endpoint";

    if (!trimmedUrl) { setErr("Endpoint URL is required."); return; }
    if (!trimmedModelId) { setErr("Model ID is required. Run 'test connection' to auto-detect it."); return; }

    // Normalize base URL
    const baseUrl = trimmedUrl.replace(/\/+$/, "").replace(/\/v1$/, "") + "/v1";

    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        name: trimmedName,
        baseUrl,
        models: [
          {
            providerModelId: trimmedModelId,
            name: trimmedName,
            __hf: true,
          },
        ],
      };
      if (token.trim()) body.apiKey = token.trim();

      const res = await fetch("/api/custom-providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "save failed");
      }
      closeForm();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove "${name}"? The model will disappear from the chat picker.`)) return;
    await fetch(`/api/custom-providers/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleEnabled(ep: HFEndpoint) {
    await fetch(`/api/custom-providers/${ep.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !ep.enabled }),
    });
    await load();
  }

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <span style={{ ...MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-3)" }}>
          settings · huggingface
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", margin: "8px 0 4px", color: "var(--fg-1)" }}>
          HuggingFace Endpoints
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Connect your HuggingFace Inference Endpoints directly. Paste the endpoint URL and
          your HF token — OpenMLC auto-detects the model and adds it to the chat picker.
        </p>
      </div>

      {/* What is this box */}
      <div style={{
        background: "var(--surface-1)",
        border: "1px solid var(--stroke-1)",
        borderRadius: "var(--r-2)",
        padding: "12px 16px",
        marginBottom: 24,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-1)", marginBottom: 4 }}>
            Dedicated endpoints
          </div>
          <div style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", lineHeight: 1.7 }}>
            Works with any endpoint on{" "}
            <code>*.huggingface.cloud</code> or the Serverless API at{" "}
            <code>api-inference.huggingface.co/v1</code>. The endpoint must
            be OpenAI-compatible (TGI or vLLM backend).
          </div>
        </div>
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          type="button"
          onClick={openForm}
          style={{
            ...MONO,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--fg-accent)",
            color: "#FAFAF7",
            border: "1px solid var(--fg-accent)",
            borderRadius: "var(--r-2)",
            padding: "8px 16px",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            marginBottom: 24,
          }}
        >
          + add endpoint
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{
          background: "var(--surface-1)",
          border: "1px solid var(--stroke-1)",
          borderRadius: "var(--r-3)",
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ fontWeight: 500, fontSize: 14, color: "var(--fg-1)", marginBottom: 16 }}>
            Add HuggingFace Endpoint
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* URL */}
            <div>
              <span style={LABEL}>endpoint url</span>
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setTestResult(null); }}
                placeholder="https://y0c585nasj45dfrh.us-east-1.aws.endpoints.huggingface.cloud"
                style={{ ...INPUT, fontFamily: "var(--font-mono)", fontSize: 12 }}
                autoComplete="off"
                spellCheck={false}
              />
              <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 4 }}>
                Without <code>/v1</code> — it will be added automatically.
              </div>
            </div>

            {/* Token */}
            <div>
              <span style={LABEL}>huggingface token</span>
              <input
                type="password"
                value={token}
                onChange={(e) => { setToken(e.target.value); setTestResult(null); }}
                placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{ ...INPUT, fontFamily: "var(--font-mono)" }}
                autoComplete="off"
              />
              <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 4 }}>
                Required for private endpoints. Get one at huggingface.co/settings/tokens.
              </div>
            </div>

            {/* Test button + result */}
            <div>
              <button
                type="button"
                onClick={testConnection}
                disabled={!url.trim() || testing}
                style={{
                  ...MONO,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "7px 14px",
                  background: "transparent",
                  color: !url.trim() || testing ? "var(--fg-4)" : "var(--fg-2)",
                  border: "1px solid var(--stroke-1)",
                  borderRadius: "var(--r-2)",
                  cursor: !url.trim() || testing ? "not-allowed" : "pointer",
                }}
              >
                {testing ? "testing…" : "test connection"}
              </button>

              {testResult && (
                <div style={{ marginTop: 10 }}>
                  {testResult.ok ? (
                    <div style={{
                      background: "color-mix(in oklch, var(--green-500) 8%, transparent)",
                      border: "1px solid color-mix(in oklch, var(--green-500) 30%, transparent)",
                      borderRadius: "var(--r-2)",
                      padding: "10px 12px",
                    }}>
                      <div style={{ ...MONO, fontSize: 11, color: "var(--green-500)", marginBottom: 4 }}>
                        ✓ connected
                      </div>
                      {testResult.models && testResult.models.length > 0 && (
                        <div style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", lineHeight: 1.6 }}>
                          {testResult.models.length === 1
                            ? `model: ${testResult.models[0]}`
                            : `${testResult.models.length} models detected`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      background: "color-mix(in oklch, var(--signal-err) 8%, transparent)",
                      border: "1px solid color-mix(in oklch, var(--signal-err) 25%, transparent)",
                      borderRadius: "var(--r-2)",
                      padding: "10px 12px",
                    }}>
                      <div style={{ ...MONO, fontSize: 11, color: "var(--signal-err)" }}>
                        ✗ {testResult.error}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Model ID — shown after test or manually fillable */}
            <div>
              <span style={LABEL}>model id</span>
              <input
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="meta-llama/Llama-3.1-70B-Instruct (auto-filled on test)"
                style={{ ...INPUT, fontFamily: "var(--font-mono)", fontSize: 12 }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Display name */}
            <div>
              <span style={LABEL}>display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Llama 3.1 70B (auto-filled on test)"
                style={INPUT}
              />
            </div>
          </div>

          {err && (
            <div style={{ ...MONO, fontSize: 11, color: "var(--signal-err)", marginTop: 12 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                ...MONO,
                background: "var(--fg-accent)",
                color: "#FAFAF7",
                border: "1px solid var(--fg-accent)",
                borderRadius: "var(--r-2)",
                padding: "7px 14px",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "saving…" : "save"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              style={{
                ...MONO,
                background: "transparent",
                color: "var(--fg-2)",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-2)",
                padding: "7px 14px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Endpoint list */}
      {loading ? (
        <div style={{ color: "var(--fg-3)", fontSize: 13 }}>Loading…</div>
      ) : endpoints.length === 0 && !showForm ? (
        <div style={{
          border: "1px dashed var(--stroke-1)",
          borderRadius: "var(--r-3)",
          padding: 40,
          textAlign: "center",
          color: "var(--fg-3)",
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          No endpoints yet.{" "}
          <button
            type="button"
            onClick={openForm}
            style={{ background: "none", border: "none", color: "var(--fg-accent)", cursor: "pointer", fontSize: 13, padding: 0 }}
          >
            Add your first endpoint →
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {endpoints.map((ep) => (
            <div
              key={ep.id}
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--stroke-1)",
                borderRadius: "var(--r-3)",
                padding: "16px 18px",
                opacity: ep.enabled ? 1 : 0.55,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>
                      {ep.name}
                    </span>
                    {ep.hasToken && (
                      <span style={{ ...MONO, fontSize: 9, color: "var(--green-500)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                        token set
                      </span>
                    )}
                    {!ep.enabled && (
                      <span style={{ ...MONO, fontSize: 9, color: "var(--fg-4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                        disabled
                      </span>
                    )}
                  </div>

                  <div style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ep.baseUrl}
                  </div>
                  <div style={{ ...MONO, fontSize: 11, color: "var(--fg-4)" }}>
                    model: {ep.modelId}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => toggleEnabled(ep)}
                    style={{
                      ...MONO,
                      fontSize: 10,
                      padding: "4px 10px",
                      background: "transparent",
                      color: ep.enabled ? "var(--fg-3)" : "var(--green-500)",
                      border: "1px solid var(--stroke-1)",
                      borderRadius: "var(--r-1)",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {ep.enabled ? "disable" : "enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(ep.id, ep.name)}
                    style={{
                      ...MONO,
                      fontSize: 10,
                      padding: "4px 10px",
                      background: "transparent",
                      color: "var(--signal-err)",
                      border: "1px solid var(--stroke-1)",
                      borderRadius: "var(--r-1)",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
