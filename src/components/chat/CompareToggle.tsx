"use client";

import { useEffect, useMemo, useState } from "react";
import { models as STATIC_MODELS, PROVIDER_LABEL } from "@/lib/providers/registry";
import type { Model } from "@/types/chat";

const PROVIDER_DOT: Record<string, string> = {
  openai: "var(--signal-ok)",
  anthropic: "#cd7f32",
  google: "var(--fg-accent)",
  xai: "var(--fg-2)",
  fireworks: "#ff6b35",
  openrouter: "#a78bfa",
  ollama: "var(--fg-3)",
};

const MAX_MODELS = 4;

export type UseCompareToggleReturn = {
  active: boolean;
  modelIds: string[];
  setActive: (v: boolean) => void;
  setModelIds: (ids: string[]) => void;
};

export function useCompareToggle(initialModelIds: string[] = []): UseCompareToggleReturn {
  const [active, setActive] = useState(false);
  const [modelIds, setModelIds] = useState<string[]>(initialModelIds);
  return { active, modelIds, setActive, setModelIds };
}

type Props = {
  active: boolean;
  modelIds: string[];
  setActive: (v: boolean) => void;
  setModelIds: (ids: string[]) => void;

  catalog?: Model[];
};

export function CompareToggle({ active, modelIds, setActive, setModelIds, catalog }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allModels, setAllModels] = useState<Model[]>(catalog ?? STATIC_MODELS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pickerOpen || catalog) return;
    if (allModels.length > STATIC_MODELS.length) return;
    setLoading(true);
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.models)) setAllModels(data.models);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pickerOpen, catalog, allModels.length]);

  const textModels = useMemo(
    () =>
      allModels.filter(
        (m) =>
          m.capabilities.includes("text") && !m.capabilities.includes("image-gen")
      ),
    [allModels]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return textModels.slice(0, 40);
    return textModels
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.providerId.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [textModels, query]);

  function toggleModel(id: string) {
    if (modelIds.includes(id)) {
      setModelIds(modelIds.filter((x) => x !== id));
    } else if (modelIds.length < MAX_MODELS) {
      setModelIds([...modelIds, id]);
    }
  }

  function removeModel(id: string) {
    setModelIds(modelIds.filter((x) => x !== id));
  }

  function handleToggleActive() {
    const next = !active;
    setActive(next);
    if (next && modelIds.length < 2) {

      const defaults = textModels.slice(0, 2).map((m) => m.id);
      setModelIds(defaults);
    }
    if (!next) setPickerOpen(false);
  }

  return (
    <div className="compare-toggle-root">

      <button
        className={`compare-toggle-btn${active ? " active" : ""}`}
        onClick={handleToggleActive}
        type="button"
        title="Toggle compare mode (2–4 models)"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M1 6h4M7 6h4" />
          <path d="M3 3v6M9 3v6" />
        </svg>
        compare
      </button>

      {active && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="compare-model-chips">
            {modelIds.map((id) => {
              const m = allModels.find((x) => x.id === id);
              const dot = PROVIDER_DOT[m?.providerId ?? ""] ?? "var(--fg-4)";
              const label = m?.name ?? id;
              return (
                <span key={id} className="compare-model-chip">
                  <span
                    className="compare-model-chip-dot"
                    style={{ background: dot }}
                  />
                  <span
                    style={{
                      maxWidth: 90,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={id}
                  >
                    {label}
                  </span>
                  <button
                    className="compare-model-chip-remove"
                    onClick={() => removeModel(id)}
                    type="button"
                    aria-label={`Remove ${label}`}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: "var(--fg-4)",
                      fontSize: 12,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}

            {modelIds.length < MAX_MODELS && (
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                style={{
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  fontSize: 10,
                  padding: "2px 6px",
                  border: "1px dashed var(--stroke-2)",
                  color: "var(--fg-4)",
                  background: "none",
                  cursor: "pointer",
                  borderRadius: 0,
                }}
              >
                + add
              </button>
            )}
          </div>

          {pickerOpen && (
            <div
              style={{
                border: "1px solid var(--stroke-2)",
                background: "var(--bg-elevated)",
                maxHeight: 240,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search models…"
                autoFocus
                style={{
                  border: "none",
                  borderBottom: "1px solid var(--stroke-1)",
                  background: "transparent",
                  padding: "6px 8px",
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  fontSize: 11,
                  color: "var(--fg-1)",
                  outline: "none",
                  flexShrink: 0,
                }}
              />
              <div style={{ overflowY: "auto", flex: "1 1 0" }}>
                {loading && (
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: 11,
                      color: "var(--fg-4)",
                      fontFamily: "var(--font-mono, ui-monospace, monospace)",
                    }}
                  >
                    loading…
                  </div>
                )}
                {filtered.map((m) => {
                  const selected = modelIds.includes(m.id);
                  const dot = PROVIDER_DOT[m.providerId] ?? "var(--fg-4)";
                  const provLabel =
                    PROVIDER_LABEL[m.providerId] ?? m.providerId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        toggleModel(m.id);
                        if (modelIds.length + 1 >= MAX_MODELS) {
                          setPickerOpen(false);
                        }
                      }}
                      disabled={!selected && modelIds.length >= MAX_MODELS}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        width: "100%",
                        padding: "5px 10px",
                        background: selected
                          ? "var(--surface-selected)"
                          : "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--stroke-1)",
                        cursor: "pointer",
                        textAlign: "left",
                        opacity: !selected && modelIds.length >= MAX_MODELS ? 0.4 : 1,
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: dot,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-mono, ui-monospace, monospace)",
                          fontSize: 11,
                          color: "var(--fg-1)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono, ui-monospace, monospace)",
                          fontSize: 10,
                          color: "var(--fg-4)",
                        }}
                      >
                        {provLabel}
                      </span>
                      {selected && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--fg-accent)",
                            fontFamily: "var(--font-mono, ui-monospace, monospace)",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {modelIds.length < 2 && (
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 10,
                color: "var(--signal-warn)",
              }}
            >
              select at least 2 models
            </span>
          )}
        </div>
      )}
    </div>
  );
}
