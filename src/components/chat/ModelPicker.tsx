"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { models as STATIC_MODELS, PROVIDER_LABEL } from "@/lib/providers/registry";
import { HudLabel } from "@/components/chrome/HudLabel";
import { cn } from "@/lib/cn";
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

const COST_LABEL: Record<string, string> = {
  free: "free",
  low: "low",
  medium: "med",
  high: "high",
};

const COST_COLOR: Record<string, string> = {
  free: "var(--fg-mint)",
  low: "var(--fg-3)",
  medium: "var(--fg-3)",
  high: "var(--signal-warn)",
};

const RECENTS_KEY = "openmlc:recent-models";

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  if (typeof window === "undefined") return;
  const cur = loadRecents().filter((x) => x !== id);
  cur.unshift(id);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, 8)));
}

function fmtContext(n?: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}m`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function matchScore(model: Model, q: string): number {
  if (!q) return 1;
  const lc = q.toLowerCase();
  const name = model.name.toLowerCase();
  const provider = model.providerId.toLowerCase();
  const id = model.id.toLowerCase();
  const desc = (model.description ?? "").toLowerCase();
  if (name === lc) return 1000;
  if (name.startsWith(lc)) return 500;
  if (name.includes(lc)) return 300;
  if (id.includes(lc)) return 250;
  if (provider.includes(lc)) return 200;
  if (desc.includes(lc)) return 100;
  return 0;
}

type Props = {
  value: string;
  onChange: (modelId: string) => void;
};

export function ModelPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allModels, setAllModels] = useState<Model[]>(STATIC_MODELS);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(
    () => allModels.find((m) => m.id === value) ?? STATIC_MODELS[0],
    [allModels, value]
  );

  useEffect(() => setRecents(loadRecents()), []);

  // Load full catalog on first open
  useEffect(() => {
    if (!open) return;
    setHighlighted(0);
    if (allModels.length <= STATIC_MODELS.length) {
      setLoading(true);
      fetch("/api/models")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (Array.isArray(data?.models)) setAllModels(data.models); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    setTimeout(() => inputRef.current?.focus(), 30);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const chatModels = useMemo(
    () => allModels.filter((m) => m.capabilities.includes("text") || m.capabilities.includes("image-gen")),
    [allModels]
  );

  const recentModels = useMemo(() => {
    if (query) return [];
    return recents
      .map((id) => allModels.find((m) => m.id === id))
      .filter((m): m is Model => Boolean(m))
      .slice(0, 5);
  }, [recents, allModels, query]);

  const filteredGroups = useMemo(() => {
    const q = query.trim();
    const scored = chatModels
      .map((m) => ({ m, s: matchScore(m, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s);

    if (q) {
      return [{ providerId: "results", label: null, models: scored.slice(0, 80).map((x) => x.m) }];
    }

    const groups: Record<string, Model[]> = {};
    for (const { m } of scored) {
      (groups[m.providerId] ||= []).push(m);
    }
    const order = ["openai", "anthropic", "google", "xai", "fireworks", "openrouter", "ollama"];
    return order
      .filter((p) => groups[p]?.length)
      .map((p) => ({ providerId: p, label: PROVIDER_LABEL[p] ?? p, models: groups[p] }));
  }, [chatModels, query]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => {
    const out: Model[] = [];
    if (!query) out.push(...recentModels);
    for (const g of filteredGroups) out.push(...g.models);
    // Deduplicate (recents may overlap with groups)
    const seen = new Set<string>();
    return out.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [recentModels, filteredGroups, query]);

  function pick(m: Model) {
    onChange(m.id);
    saveRecent(m.id);
    setRecents(loadRecents());
    setOpen(false);
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = flatList[highlighted];
      if (m) pick(m);
    }
  }, [flatList, highlighted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll highlighted into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlighted}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="model-pick-btn"
        title="Switch model"
      >
        <span className="model-pick-dot" style={{ background: PROVIDER_DOT[current.providerId] }} aria-hidden />
        <span className="model-pick-name">{current.name}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 16V4m0 0L3 8m4-4l4 4" />
          <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </button>

      {/* Modal portal */}
      {open && typeof window !== "undefined" && createPortal(
        <div className="model-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="model-modal glass-strong" role="dialog" aria-modal aria-label="Select model" onKeyDown={handleKeyDown}>

            {/* Header */}
            <div className="model-modal-head">
              <HudLabel>select model</HudLabel>
              <div className="model-modal-search">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-3.5-3.5" />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
                  placeholder="search models, providers, capabilities…"
                  className="model-modal-input"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="model-modal-count">{loading ? "loading…" : `${chatModels.length} models`}</span>
              </div>
              <button type="button" className="model-modal-close" onClick={() => setOpen(false)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="model-modal-body" ref={listRef}>
              {recentModels.length > 0 && !query && (
                <div className="model-modal-section">
                  <div className="model-modal-group-label">
                    <HudLabel>recent</HudLabel>
                  </div>
                  {recentModels.map((m) => {
                    const idx = flatList.indexOf(m);
                    return (
                      <ModelRow
                        key={`r-${m.id}`}
                        model={m}
                        active={m.id === value}
                        highlighted={idx === highlighted}
                        dataIdx={idx}
                        onPick={pick}
                        onHover={() => setHighlighted(idx)}
                      />
                    );
                  })}
                </div>
              )}

              {filteredGroups.map((group) => (
                <div key={group.providerId} className="model-modal-section">
                  {group.label && (
                    <div className="model-modal-group-label">
                      <span className="model-modal-provider-dot" style={{ background: PROVIDER_DOT[group.providerId] }} aria-hidden />
                      <HudLabel>{group.label}</HudLabel>
                      <span className="model-modal-group-count">{group.models.length}</span>
                    </div>
                  )}
                  {group.models.map((m) => {
                    const idx = flatList.indexOf(m);
                    return (
                      <ModelRow
                        key={m.id}
                        model={m}
                        active={m.id === value}
                        highlighted={idx === highlighted}
                        dataIdx={idx}
                        onPick={pick}
                        onHover={() => setHighlighted(idx)}
                      />
                    );
                  })}
                </div>
              ))}

              {flatList.length === 0 && (
                <div className="model-modal-empty">
                  no models match <span style={{ fontFamily: "var(--font-mono)" }}>{query}</span>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="model-modal-foot">
              <span><kbd>↑↓</kbd> navigate</span>
              <span><kbd>↵</kbd> select</span>
              <span><kbd>esc</kbd> dismiss</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function ModelRow({
  model, active, highlighted, dataIdx, onPick, onHover,
}: {
  model: Model;
  active: boolean;
  highlighted: boolean;
  dataIdx: number;
  onPick: (m: Model) => void;
  onHover: () => void;
}) {
  const caps = model.capabilities.filter((c) => c !== "text" && c !== "image-gen");
  return (
    <button
      type="button"
      data-idx={dataIdx}
      onClick={() => onPick(model)}
      onMouseEnter={onHover}
      className={cn(
        "model-modal-row",
        active && "active",
        highlighted && !active && "hover"
      )}
    >
      <span className="model-modal-row-dot" style={{ background: PROVIDER_DOT[model.providerId] }} aria-hidden />
      <span className="model-modal-row-body">
        <span className="model-modal-row-top">
          <span className="model-modal-row-name">{model.name}</span>
          {model.costTier && (
            <span className="model-modal-row-cost" style={{ color: COST_COLOR[model.costTier] }}>
              {COST_LABEL[model.costTier] ?? model.costTier}
            </span>
          )}
          {caps.slice(0, 3).map((cap) => (
            <span key={cap} className="model-modal-row-cap">{cap}</span>
          ))}
          {model.contextWindow && (
            <span className="model-modal-row-ctx">{fmtContext(model.contextWindow)} ctx</span>
          )}
        </span>
        {model.description && (
          <span className="model-modal-row-desc">{model.description}</span>
        )}
      </span>
      {active && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="model-modal-row-check" aria-hidden>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}
