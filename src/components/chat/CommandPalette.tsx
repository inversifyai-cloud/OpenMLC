"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  title: string;
  modelId: string;
  updatedAt: string;
  snippet?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const search = useCallback((val: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setCursor(0);
      } catch {  }
      finally { setLoading(false); }
    }, 180);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQ(e.target.value);
    search(e.target.value);
  }

  function navigate(id: string) {
    router.push(`/chat/${id}`);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
    if (e.key === "Enter" && results[cursor]) { navigate(results[cursor].id); return; }
  }

  if (!open) return null;

  return (
    <div className="cp-backdrop" onClick={onClose} role="dialog" aria-modal aria-label="Command palette">
      <div className="cp-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cp-search-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="cp-search-icon" aria-hidden>
            <circle cx="10" cy="10" r="6" />
            <path d="M14.5 14.5l5 5" />
          </svg>
          <input
            ref={inputRef}
            className="cp-input"
            value={q}
            onChange={handleChange}
            placeholder="search conversations and messages…"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="cp-loading">…</span>}
          <kbd className="cp-esc">esc</kbd>
        </div>

        {results.length > 0 && (
          <div className="cp-results" role="listbox">
            {results.map((r, i) => (
              <button
                key={r.id}
                role="option"
                aria-selected={i === cursor}
                className={`cp-row${i === cursor ? " cp-row--active" : ""}`}
                onClick={() => navigate(r.id)}
                onMouseEnter={() => setCursor(i)}
                type="button"
              >
                <span className="cp-row-title">{r.title || "untitled"}</span>
                {r.snippet && <span className="cp-row-snippet">{r.snippet}</span>}
                <span className="cp-row-model">{r.modelId}</span>
              </button>
            ))}
          </div>
        )}

        {q.trim() && !loading && results.length === 0 && (
          <div className="cp-empty">no results for &ldquo;{q}&rdquo;</div>
        )}

        <div className="cp-foot">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
