"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Kind = "chat" | "setting" | "space" | "library" | "model";
type Scope = "all" | Kind;

type Result = {
  kind: Kind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  modelId?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "all" },
  { value: "chat", label: "chats" },
  { value: "setting", label: "settings" },
  { value: "space", label: "spaces" },
  { value: "library", label: "library" },
  { value: "model", label: "models" },
];

function KindIcon({ kind }: { kind: Kind }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "palette-row-icon",
  };
  switch (kind) {
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4z" />
        </svg>
      );
    case "setting":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      );
    case "space":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M4 9h16" />
        </svg>
      );
    case "library":
      return (
        <svg {...common}>
          <path d="M3 7h18v3H3z" />
          <path d="M5 10v10h14V10" />
          <path d="M10 14h4" />
        </svg>
      );
    case "model":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
        </svg>
      );
  }
}

const KIND_LABEL: Record<Kind, string> = {
  chat: "chat",
  setting: "setting",
  space: "space",
  library: "library",
  model: "model",
};

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [results, setResults] = useState<Result[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setCursor(0);
      setScope("all");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const search = useCallback((val: string, kind: Scope) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const id = ++reqIdRef.current;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search/global?q=${encodeURIComponent(val)}&kind=${encodeURIComponent(kind)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (id !== reqIdRef.current) return;
        setResults(Array.isArray(data?.results) ? data.results : []);
        setCursor(0);
      } catch {
        if (id === reqIdRef.current) setResults([]);
      } finally {
        if (id === reqIdRef.current) setLoading(false);
      }
    }, 160);
  }, []);

  useEffect(() => {
    if (open) search(q, scope);
    // re-run when scope flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQ(v);
    search(v, scope);
  }

  const navigate = useCallback(
    (r: Result) => {
      router.push(r.href);
      onClose();
    },
    [router, onClose]
  );

  // Auto-scroll active row into view.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [cursor, results.length]);

  const scopeOrder = useMemo(() => SCOPES.map((s) => s.value), []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const r = results[cursor];
      if (r) navigate(r);
      return;
    }
    if (e.key === "ArrowRight") {
      // Only intercept when caret is at end of input
      const input = inputRef.current;
      if (input && input.selectionStart !== input.value.length) return;
      const r = results[cursor];
      if (r) {
        e.preventDefault();
        setScope(r.kind);
      } else if (scope === "all") {
        e.preventDefault();
        const idx = scopeOrder.indexOf(scope);
        const next = scopeOrder[Math.min(idx + 1, scopeOrder.length - 1)];
        if (next) setScope(next);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      const input = inputRef.current;
      if (input && input.selectionStart !== 0) return;
      if (scope !== "all") {
        e.preventDefault();
        setScope("all");
      }
      return;
    }
  }

  if (!open) return null;

  return (
    <div
      className="palette-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Command palette"
    >
      <div
        className="palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="palette-chips" role="tablist" aria-label="search scope">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={scope === s.value}
              data-active={scope === s.value}
              className="palette-chip"
              onClick={() => {
                setScope(s.value);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="palette-search-row">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="palette-search-icon"
            aria-hidden
          >
            <circle cx="10" cy="10" r="6" />
            <path d="M14.5 14.5l5 5" />
          </svg>
          <input
            ref={inputRef}
            className="palette-input"
            value={q}
            onChange={handleChange}
            placeholder={
              scope === "all"
                ? "search everything…"
                : `search ${scope === "setting" ? "settings" : scope + "s"}…`
            }
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="palette-loading">…</span>}
          <kbd className="palette-esc">esc</kbd>
        </div>

        <div className="palette-results" role="listbox" ref={listRef}>
          {results.map((r, i) => (
            <button
              key={`${r.kind}:${r.id}`}
              role="option"
              aria-selected={i === cursor}
              data-active={i === cursor}
              data-idx={i}
              className="palette-row"
              onClick={() => navigate(r)}
              onMouseEnter={() => setCursor(i)}
              type="button"
            >
              <KindIcon kind={r.kind} />
              <span className="palette-row-body">
                <span className="palette-row-title">{r.title || "untitled"}</span>
                {r.subtitle && (
                  <span className="palette-row-subtitle">{r.subtitle}</span>
                )}
              </span>
              <span className="palette-row-kind">{KIND_LABEL[r.kind]}</span>
            </button>
          ))}
          {q.trim() && !loading && results.length === 0 && (
            <div className="palette-empty">no results for &ldquo;{q}&rdquo;</div>
          )}
          {!q.trim() && (
            <div className="palette-empty">type to search · ← → switches scope</div>
          )}
        </div>

        <div className="palette-foot">
          <span><kbd>↑↓</kbd>navigate</span>
          <span><kbd>↵</kbd>open</span>
          <span><kbd>→</kbd>scope</span>
          <span><kbd>←</kbd>all</span>
          <span><kbd>esc</kbd>close</span>
        </div>
      </div>
    </div>
  );
}
