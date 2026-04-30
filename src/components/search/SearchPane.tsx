"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Match = {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  role: "user" | "assistant";
  modelId: string | null;
  snippet: string;
  createdAt: string;
};

const PLACEHOLDER =
  'try: weather  from:user  before:2026-04-01  in:space:travel  "exact phrase"';

const OPERATOR_HINTS: Array<{ k: string; t: string }> = [
  { k: "from:", t: "user / assistant" },
  { k: "model:", t: "substring of model id" },
  { k: "before:", t: "YYYY-MM-DD or 7d / 1mo" },
  { k: "after:", t: "YYYY-MM-DD or 7d / 1mo" },
  { k: "in:space:", t: "space name or id" },
  { k: "in:conv:", t: "conversation id" },
  { k: '"phrase"', t: "exact match" },
];

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}

/**
 * Extract bare terms + phrases from query for client-side highlight.
 * (We deliberately don't import the parser to keep this RSC-light.)
 */
function highlightNeedles(q: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = q.length;
  while (i < n) {
    const ch = q[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (ch === '"') {
      let j = i + 1;
      let buf = "";
      while (j < n && q[j] !== '"') { buf += q[j]; j++; }
      if (buf) out.push(buf);
      i = j + 1;
      continue;
    }
    let j = i;
    let buf = "";
    while (j < n && q[j] !== " " && q[j] !== "\t" && q[j] !== '"') {
      buf += q[j]; j++;
    }
    if (buf && !/^(from|model|before|after|in):/i.test(buf)) {
      out.push(buf);
    }
    i = j;
  }
  return out.filter((s) => s.length > 0);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, needles: string[]): React.ReactNode {
  if (needles.length === 0) return text;
  const pattern = new RegExp(
    `(${needles.map(escapeRegex).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  return parts.map((p, i) =>
    i % 2 === 1 ? <mark key={i} className="srch-mark">{p}</mark> : <span key={i}>{p}</span>,
  );
}

function RoleGlyph({ role }: { role: "user" | "assistant" }) {
  if (role === "user") {
    return (
      <svg className="srch-glyph" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="6" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M3 13c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className="srch-glyph" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="3" y="4" width="10" height="8" rx="2"
        fill="none" stroke="currentColor" strokeWidth="1.2"
      />
      <circle cx="6.5" cy="8" r="0.9" fill="currentColor" />
      <circle cx="9.5" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function SearchPane({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // debounce
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatches([]);
      setError(null);
      setHasSearched(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search/messages?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(`search failed (${r.status})`);
          return (await r.json()) as { matches: Match[] };
        })
        .then((data) => {
          setMatches(data.matches);
          setError(null);
          setHasSearched(true);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setError(err instanceof Error ? err.message : "search failed");
          setMatches([]);
          setHasSearched(true);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  // sync ?q= in URL without scroll
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cur = new URL(window.location.href);
    const next = query.trim();
    if (next === (cur.searchParams.get("q") ?? "")) return;
    if (next) cur.searchParams.set("q", next);
    else cur.searchParams.delete("q");
    window.history.replaceState({}, "", cur.toString());
  }, [query]);

  const needles = useMemo(() => highlightNeedles(query), [query]);

  const grouped = useMemo(() => {
    const m = new Map<string, { title: string; rows: Match[] }>();
    for (const r of matches) {
      const g = m.get(r.conversationId);
      if (g) g.rows.push(r);
      else m.set(r.conversationId, { title: r.conversationTitle, rows: [r] });
    }
    return Array.from(m.entries()).map(([conversationId, v]) => ({
      conversationId,
      title: v.title,
      rows: v.rows,
    }));
  }, [matches]);

  function gotoMatch(convId: string, msgId: string) {
    router.push(`/chat/${convId}?msg=${msgId}`);
  }

  return (
    <div className="srch-root">
      <div className="srch-input-wrap">
        <svg className="srch-icon" viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="srch-input"
          type="text"
          value={query}
          placeholder={PLACEHOLDER}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        {loading ? <span className="srch-loading" aria-label="loading">…</span> : null}
      </div>

      {!query.trim() && (
        <div className="srch-cheatsheet">
          <div className="srch-cheatsheet__title">operators</div>
          <ul className="srch-cheatsheet__list">
            {OPERATOR_HINTS.map((h) => (
              <li key={h.k}>
                <code className="srch-op">{h.k}</code>
                <span className="srch-op-desc">{h.t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="srch-error">· {error}</div>}

      {hasSearched && !loading && matches.length === 0 && !error && (
        <div className="srch-empty">
          <span className="srch-empty__line">nothing matched.</span>
          <span className="srch-empty__hint">
            try fewer terms, drop an operator, or widen the date range.
          </span>
        </div>
      )}

      {grouped.length > 0 && (
        <div className="srch-results">
          <div className="srch-meta">
            <span className="srch-meta__count">{matches.length}</span>
            <span>
              match{matches.length === 1 ? "" : "es"} across{" "}
              <span className="srch-meta__count">{grouped.length}</span>{" "}
              conversation{grouped.length === 1 ? "" : "s"}
            </span>
          </div>
          {grouped.map((g) => (
            <section className="srch-group" key={g.conversationId}>
              <header className="srch-group__head">
                <span className="srch-group__title">{g.title || "untitled"}</span>
                <span className="srch-group__count">
                  {g.rows.length} match{g.rows.length === 1 ? "" : "es"}
                </span>
              </header>
              <ul className="srch-group__list">
                {g.rows.map((m) => (
                  <li key={m.messageId}>
                    <button
                      type="button"
                      className="srch-row"
                      onClick={() => gotoMatch(m.conversationId, m.messageId)}
                    >
                      <span className={`srch-role srch-role--${m.role}`}>
                        <RoleGlyph role={m.role} />
                        <span>{m.role}</span>
                      </span>
                      <span className="srch-snippet">
                        {highlight(m.snippet, needles)}
                      </span>
                      <span className="srch-row__foot">
                        {m.modelId ? (
                          <span className="srch-model">{m.modelId}</span>
                        ) : null}
                        <span className="srch-time">{relTime(m.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
