"use client";

import { useEffect, useRef, useState } from "react";
const PROVIDER_DOT: Record<string, string> = {
  openai: "var(--signal-ok)",
  anthropic: "#cd7f32",
  google: "var(--fg-accent)",
  xai: "var(--fg-2)",
  fireworks: "#ff6b35",
  openrouter: "#a78bfa",
  ollama: "var(--fg-3)",
};

function dotColor(modelId: string): string {
  for (const [provider, color] of Object.entries(PROVIDER_DOT)) {
    if (modelId.startsWith(provider) || modelId.includes(`:${provider}:`)) {
      return color;
    }
  }

  const prefix = modelId.split(":")[0];
  return PROVIDER_DOT[prefix] ?? "var(--fg-4)";
}

type ModelState = {
  modelId: string;
  text: string;
  done: boolean;
  error: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
};

type Props = {
  prompt: string;
  modelIds: string[];
  onPickWinner: (modelId: string, text: string) => void;
  onCancel: () => void;
};

export function CompareView({ prompt, modelIds, onPickWinner, onCancel }: Props) {
  const [cols, setCols] = useState<ModelState[]>(
    modelIds.map((modelId) => ({
      modelId,
      text: "",
      done: false,
      error: null,
      usage: null,
    }))
  );
  const [globalDone, setGlobalDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      let res: Response;
      try {
        res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, modelIds }),
          signal: ctrl.signal,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setCols((prev) =>
          prev.map((c) => ({ ...c, error: "connection failed", done: true }))
        );
        return;
      }

      if (!res.ok || !res.body) {
        const msg = `server error ${res.status}`;
        setCols((prev) => prev.map((c) => ({ ...c, error: msg, done: true })));
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            setGlobalDone(true);
            continue;
          }
          try {
            const evt = JSON.parse(payload) as {
              modelId: string;
              type: "delta" | "done" | "error";
              text?: string;
              usage?: { inputTokens: number; outputTokens: number };
              error?: string;
            };

            setCols((prev) =>
              prev.map((c) => {
                if (c.modelId !== evt.modelId) return c;
                if (evt.type === "delta") {
                  return { ...c, text: c.text + (evt.text ?? "") };
                }
                if (evt.type === "done") {
                  return { ...c, done: true, usage: evt.usage ?? null };
                }
                if (evt.type === "error") {
                  return { ...c, done: true, error: evt.error ?? "error" };
                }
                return c;
              })
            );
          } catch {

          }
        }
      }
    })();

    return () => {
      ctrl.abort();
    };

  }, []);

  function handleCancel() {
    abortRef.current?.abort();
    onCancel();
  }

  const allDone = globalDone || cols.every((c) => c.done);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-app)",
      }}
    >

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid var(--stroke-1)",
          background: "var(--bg-canvas)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--fg-2)",
            textTransform: "uppercase",
          }}
        >
          COMPARE · {cols.length} models
        </span>
        <button
          onClick={handleCancel}
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: 11,
            color: "var(--fg-3)",
            background: "none",
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.04em",
            padding: "2px 6px",
          }}
        >
          ✕ cancel
        </button>
      </div>

      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid var(--stroke-1)",
          fontSize: 13,
          color: "var(--fg-2)",
          background: "var(--bg-sunken)",
          flexShrink: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {prompt}
      </div>

      <div className="compare-grid" style={{ flex: "1 1 0", minHeight: 0 }}>
        {cols.map((col) => {
          const providerId = col.modelId.split(":")[0];
          const dot = dotColor(col.modelId);
          const shortLabel = col.modelId.split(":").slice(1).join(":") || col.modelId;
          const streaming = !col.done && !col.error;

          return (
            <div key={col.modelId} className="compare-col">
              <div className="compare-col-header">
                <span
                  className="compare-provider-dot"
                  style={{ background: dot }}
                />
                <span className="compare-model-label" title={col.modelId}>
                  {shortLabel}
                </span>
              </div>

              <div
                className={`compare-col-body${streaming ? " streaming" : ""}`}
                aria-label={`Response from ${col.modelId}`}
              >
                {col.error ? (
                  <span className="compare-error">{col.error}</span>
                ) : (
                  col.text || (
                    <span style={{ color: "var(--fg-4)", fontStyle: "italic" }}>
                      waiting…
                    </span>
                  )
                )}
              </div>

              <div className="compare-col-footer">
                <span className="compare-usage-chip">
                  {col.usage
                    ? `↑${col.usage.inputTokens} ↓${col.usage.outputTokens}`
                    : col.done
                    ? "—"
                    : "streaming"}
                </span>
                <button
                  className="compare-pick-btn"
                  disabled={!allDone || !!col.error || !col.text}
                  onClick={() => onPickWinner(col.modelId, col.text)}
                  title={`Use ${col.modelId}'s answer`}
                >
                  pick winner
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <span style={{ display: "none" }} aria-hidden />
    </div>
  );
}
