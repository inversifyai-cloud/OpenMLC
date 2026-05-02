"use client";

import { useEffect, useRef, useState } from "react";
import type { HubModel } from "@/lib/ollama/hub";
import { QUANT_OPTIONS } from "@/lib/ollama/hub";

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
const SELECT_STYLE: React.CSSProperties = {
  background: "var(--bg-canvas)",
  border: "1px solid var(--stroke-1)",
  borderRadius: "var(--r-1)",
  color: "var(--fg-1)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  padding: "5px 8px",
  width: "100%",
  outline: "none",
  cursor: "pointer",
};

const TAG_COLORS: Record<string, string> = {
  fast:        "var(--green-500)",
  code:        "var(--fg-accent)",
  vision:      "#a78bfa",
  reasoning:   "#f59e0b",
  large:       "var(--fg-3)",
  embedding:   "#06b6d4",
  multilingual:"#ec4899",
  moe:         "#8b5cf6",
};

type PullState = {
  status: string;
  completed?: number;
  total?: number;
};

type PageData = {
  reachable: boolean;
  installed: string[];
  hub: HubModel[];
  ollamaUrl?: string;
};

function humanBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

function ProgressBar({ pullState }: { pullState: PullState }) {
  const pct =
    pullState.total && pullState.completed !== undefined
      ? Math.round((pullState.completed / pullState.total) * 100)
      : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ ...MONO, fontSize: 10, color: "var(--fg-3)" }}>
          {pullState.status || "connecting…"}
        </span>
        {pct !== null && (
          <span style={{ ...MONO, fontSize: 10, color: "var(--fg-2)" }}>{pct}%</span>
        )}
      </div>
      <div style={{ height: 3, background: "var(--stroke-1)", borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: pct !== null ? `${pct}%` : "30%",
            background: "var(--green-500)",
            borderRadius: 2,
            transition: pct !== null ? "width 0.3s ease" : undefined,
            animation: pct === null ? "pulse-bar 1.2s ease-in-out infinite" : undefined,
          }}
        />
      </div>
      {pullState.total && pullState.completed !== undefined && (
        <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 4 }}>
          {humanBytes(pullState.completed)} / {humanBytes(pullState.total)}
        </div>
      )}
    </div>
  );
}

function PullByName({
  pulling,
  pullState,
  onPull,
}: {
  pulling: string | null;
  pullState: PullState | null;
  onPull: (modelId: string) => void;
}) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");

  const isPulling = !!submitted && pulling === submitted;

  useEffect(() => {
    if (!pulling) setSubmitted("");
  }, [pulling]);

  function handlePull() {
    const model = input.trim();
    if (!model || pulling) return;
    setSubmitted(model);
    onPull(model);
  }

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--stroke-1)",
        borderRadius: "var(--r-2)",
        padding: "14px 16px",
        marginBottom: 20,
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 13, color: "var(--fg-1)", marginBottom: 4 }}>
        Pull any model
      </div>
      <p style={{ ...MONO, fontSize: 11, color: "var(--fg-3)", margin: "0 0 12px", lineHeight: 1.6 }}>
        Enter any Ollama model tag — including quantization suffixes like{" "}
        <code>qwen3:14b-q4_K_M</code> or <code>llama3.1:8b-q8_0</code>.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handlePull(); }}
          placeholder="e.g. qwen3:14b-q4_K_M"
          disabled={!!pulling}
          style={{
            flex: 1,
            ...MONO,
            fontSize: 12,
            background: "var(--bg-canvas)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-1)",
            color: "var(--fg-1)",
            padding: "7px 10px",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={handlePull}
          disabled={!input.trim() || !!pulling}
          style={{
            ...MONO,
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "7px 14px",
            background: !input.trim() || pulling ? "transparent" : "var(--fg-accent)",
            color: !input.trim() || pulling ? "var(--fg-3)" : "#FAFAF7",
            border: `1px solid ${!input.trim() || pulling ? "var(--stroke-1)" : "var(--fg-accent)"}`,
            borderRadius: "var(--r-1)",
            cursor: !input.trim() || pulling ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isPulling ? "pulling…" : "pull"}
        </button>
      </div>

      {isPulling && pullState && (
        <div style={{ marginTop: 12 }}>
          <ProgressBar pullState={pullState} />
        </div>
      )}
    </div>
  );
}

function ModelCard({
  model,
  installed,
  onInstall,
  onRemove,
  pulling,
  pullState,
}: {
  model: HubModel;
  installed: string[];
  onInstall: (modelId: string) => void;
  onRemove: (modelId: string) => void;
  pulling: string | null;
  pullState: PullState | null;
}) {
  const [selectedSizeId, setSelectedSizeId] = useState(model.sizes[0]?.id ?? model.id);
  const [quantSuffix, setQuantSuffix] = useState("");

  const selectedSize = model.sizes.find((s) => s.id === selectedSizeId) ?? model.sizes[0];

  // Only show quant picker when the selected size has explicitly listed quants.
  const availableQuants = selectedSize?.quants
    ? QUANT_OPTIONS.filter((q) => q.suffix === "" || selectedSize.quants!.includes(q.suffix))
    : null;

  // Reset quant when size changes and the previous suffix isn't available.
  const effectiveSuffix = availableQuants?.some((q) => q.suffix === quantSuffix)
    ? quantSuffix
    : "";

  const pullId = selectedSizeId + effectiveSuffix;

  const selectedQuant = QUANT_OPTIONS.find((q) => q.suffix === effectiveSuffix) ?? QUANT_OPTIONS[0];
  const estimatedGb = selectedSize
    ? (selectedSize.diskGb * selectedQuant.sizeMultiplier).toFixed(1)
    : null;

  const anyInstalled = model.sizes.some((s) =>
    installed.some((i) => i === s.id || i.replace(/:latest$/, "") === s.id || i.startsWith(s.id + "-"))
  );
  const isInstalled = installed.some(
    (i) => i === pullId || i.replace(/:latest$/, "") === pullId
  );
  const isPulling = pulling === pullId;

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: `1px solid ${anyInstalled ? "var(--green-500)" : "var(--stroke-1)"}`,
        borderRadius: "var(--r-3)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
      }}
    >
      {anyInstalled && (
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            ...MONO,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--green-500)",
          }}
        >
          installed
        </span>
      )}

      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{model.name}</span>
          <span style={{ ...MONO, fontSize: 10, color: "var(--fg-3)" }}>{model.paramSize}</span>
          {model.tags.map((tag) => (
            <span
              key={tag}
              style={{
                ...MONO,
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: TAG_COLORS[tag] ?? "var(--fg-3)",
                border: `1px solid ${TAG_COLORS[tag] ?? "var(--stroke-1)"}`,
                borderRadius: "var(--r-1)",
                padding: "1px 5px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, margin: 0 }}>
          {model.description}
        </p>
      </div>

      {/* Size picker */}
      {model.sizes.length > 1 && (
        <div>
          <span style={LABEL}>size</span>
          <select
            value={selectedSizeId}
            onChange={(e) => setSelectedSizeId(e.target.value)}
            disabled={!!pulling}
            style={SELECT_STYLE}
          >
            {model.sizes.map((s) => {
              const isAnyQuant = installed.some(
                (i) => i === s.id || i.replace(/:latest$/, "") === s.id || i.startsWith(s.id + "-")
              );
              return (
                <option key={s.id} value={s.id}>
                  {s.params} · ~{s.diskGb} GB{isAnyQuant ? " ✓" : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Quantization picker — only shown when the selected size has explicit quants */}
      {availableQuants && availableQuants.length > 1 && (
        <div>
          <span style={LABEL}>quantization</span>
          <select
            value={effectiveSuffix}
            onChange={(e) => setQuantSuffix(e.target.value)}
            disabled={!!pulling}
            style={SELECT_STYLE}
          >
            {availableQuants.map((q) => {
              const thisId = selectedSizeId + q.suffix;
              const inst = installed.some(
                (i) => i === thisId || i.replace(/:latest$/, "") === thisId
              );
              const gb = selectedSize
                ? (selectedSize.diskGb * q.sizeMultiplier).toFixed(1)
                : "?";
              return (
                <option key={q.suffix} value={q.suffix}>
                  {q.label || "default"} · ~{gb} GB · {q.note}{inst ? " ✓" : ""}
                </option>
              );
            })}
          </select>
          <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)", marginTop: 4 }}>
            pull id: <code>{pullId}</code>
            {estimatedGb && <span style={{ marginLeft: 8 }}>· ~{estimatedGb} GB</span>}
          </div>
        </div>
      )}

      {(!availableQuants || availableQuants.length <= 1) && estimatedGb && (
        <div style={{ ...MONO, fontSize: 10, color: "var(--fg-4)" }}>
          ~{estimatedGb} GB
        </div>
      )}

      {/* Pull progress */}
      {isPulling && pullState && <ProgressBar pullState={pullState} />}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        {isInstalled ? (
          <button
            type="button"
            onClick={() => onRemove(pullId)}
            disabled={!!pulling}
            style={{
              ...MONO,
              flex: 1,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "6px 10px",
              background: "transparent",
              color: "var(--signal-err)",
              border: "1px solid var(--stroke-1)",
              borderRadius: "var(--r-1)",
              cursor: pulling ? "not-allowed" : "pointer",
            }}
          >
            remove
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onInstall(pullId)}
            disabled={!!pulling}
            style={{
              ...MONO,
              flex: 1,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "6px 10px",
              background: pulling ? "transparent" : "var(--fg-accent)",
              color: pulling ? "var(--fg-3)" : "#FAFAF7",
              border: `1px solid ${pulling ? "var(--stroke-1)" : "var(--fg-accent)"}`,
              borderRadius: "var(--r-1)",
              cursor: pulling ? "not-allowed" : "pointer",
            }}
          >
            {isPulling ? "installing…" : "install"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function OllamaPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullState, setPullState] = useState<PullState | null>(null);
  const [filterTag, setFilterTag] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/ollama/models");
      setData((await res.json()) as PageData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleInstall(modelId: string) {
    setErr(null);
    setPulling(modelId);
    setPullState({ status: "connecting…" });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: modelId }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as {
              status?: string;
              completed?: number;
              total?: number;
              error?: string;
            };
            if (evt.error) throw new Error(evt.error);
            if (evt.status === "done") break;
            setPullState({ status: evt.status ?? "", completed: evt.completed, total: evt.total });
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") {
        setErr(e instanceof Error ? e.message : "pull failed");
      }
    } finally {
      setPulling(null);
      setPullState(null);
      abortRef.current = null;
      void load();
    }
  }

  async function handleRemove(modelId: string) {
    if (!confirm(`Remove ${modelId} from Ollama? This frees disk space.`)) return;
    setErr(null);
    try {
      const res = await fetch("/api/ollama/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "delete failed");
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
    }
  }

  const allTags = ["all", "fast", "code", "vision", "reasoning", "embedding", "multilingual", "moe", "large"];

  const visibleModels = (data?.hub ?? []).filter((m) =>
    filterTag === "all" ? true : m.tags.includes(filterTag as never)
  );

  if (loading) {
    return (
      <div style={{ maxWidth: 920 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Local models</h1>
        <p style={{ color: "var(--fg-3)", fontSize: 13 }}>Connecting to Ollama…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Local models</h1>
        <p style={{ color: "var(--fg-3)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Pick a model and click install — OpenMLC pulls it into Ollama automatically.
          Models run entirely on your machine, no API key needed.
        </p>
      </div>

      {!data?.reachable && (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--stroke-warn, #f59e0b44)",
            borderRadius: "var(--r-2)",
            padding: "12px 14px",
            marginBottom: 20,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 16 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-1)", marginBottom: 3 }}>
              Ollama not reachable
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}>
              If you&apos;re using the docker-compose setup, make sure the{" "}
              <code style={MONO}>ollama</code> service is running:{" "}
              <code style={{ ...MONO, fontSize: 11 }}>docker compose up -d ollama</code>.
              If you&apos;re running Ollama externally, set its URL under{" "}
              <strong>Settings → API keys → Ollama</strong>.
            </div>
          </div>
        </div>
      )}

      {data?.reachable && data.installed.length > 0 && (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-2)",
            padding: "10px 14px",
            marginBottom: 20,
          }}
        >
          <span style={LABEL}>installed models</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.installed.map((m) => (
              <span
                key={m}
                style={{
                  ...MONO,
                  fontSize: 11,
                  color: "var(--green-500)",
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--green-500)",
                  borderRadius: "var(--r-1)",
                  padding: "3px 8px",
                }}
              >
                {m.replace(/:latest$/, "")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pull by model name */}
      <PullByName
        pulling={pulling}
        pullState={pulling ? pullState : null}
        onPull={handleInstall}
      />

      {err && (
        <div style={{ color: "var(--signal-err)", fontSize: 12, marginBottom: 16, fontFamily: "var(--font-mono)" }}>
          {err}
        </div>
      )}

      {/* Tag filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setFilterTag(tag)}
            style={{
              ...MONO,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "5px 10px",
              background: filterTag === tag ? "var(--fg-accent)" : "transparent",
              color: filterTag === tag ? "#FAFAF7" : TAG_COLORS[tag] ?? "var(--fg-3)",
              border: `1px solid ${filterTag === tag ? "var(--fg-accent)" : TAG_COLORS[tag] ?? "var(--stroke-1)"}`,
              borderRadius: "var(--r-1)",
              cursor: "pointer",
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Model grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {visibleModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            installed={data?.installed ?? []}
            onInstall={handleInstall}
            onRemove={handleRemove}
            pulling={pulling}
            pullState={pulling ? pullState : null}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse-bar {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
