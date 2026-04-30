"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/cn-time";

export type LibraryKind = "artifact" | "research" | "browser";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  title: string;
  subtitle: string;
  createdAt: string;
  conversationId: string | null;
  type?: string;
  language?: string | null;
  preview?: string;
}

interface Props {
  initialItems: LibraryItem[];
  initialCursor: string | null;
  totalLabel: string;
}

const KIND_LABEL: Record<LibraryKind, string> = {
  artifact: "Figure",
  research: "Research",
  browser: "Session",
};

const ARTIFACT_TYPE_LABEL: Record<string, string> = {
  html: "Document",
  svg: "Vector",
  code: "Listing",
  markdown: "Note",
  react: "Component",
  mermaid: "Diagram",
  chart: "Figure",
  research: "Research",
};

function detailHref(item: LibraryItem): string {
  return `/library/${item.kind}:${item.id}`;
}

function KindGlyph({ item }: { item: LibraryItem }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (item.kind === "research") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6" />
        <path d="m21 21-5.5-5.5M11 8v6M8 11h6" />
      </svg>
    );
  }
  if (item.kind === "browser") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }
  switch (item.type) {
    case "html":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="M3 9h18" />
        </svg>
      );
    case "svg":
      return (
        <svg {...common}>
          <circle cx="8" cy="9" r="2" />
          <path d="M21 18 14 11l-9 9" />
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <path d="m9 16-4-4 4-4M15 8l4 4-4 4" />
        </svg>
      );
    case "markdown":
      return (
        <svg {...common}>
          <path d="M5 5h14v14H5z" />
          <path d="M8 15V9l2 2 2-2v6M16 9v6m0 0-2-2m2 2 2-2" />
        </svg>
      );
    case "react":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2" />
          <ellipse cx="12" cy="12" rx="10" ry="4" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
        </svg>
      );
    case "mermaid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="6" height="4" rx="0.5" />
          <rect x="15" y="3" width="6" height="4" rx="0.5" />
          <rect x="9" y="17" width="6" height="4" rx="0.5" />
          <path d="M6 7v3a2 2 0 0 0 2 2h8a2 2 0 0 1 2 2v3M18 7v3a2 2 0 0 1-2 2h0" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 20V8M10 20v-7M16 20v-4M22 20V4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
  }
}

function typeLabel(item: LibraryItem): string {
  if (item.kind === "artifact") {
    return (item.type && ARTIFACT_TYPE_LABEL[item.type]) ?? "Figure";
  }
  return KIND_LABEL[item.kind];
}

export function LibraryGrid({ initialItems, initialCursor, totalLabel }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [items, setItems] = useState<LibraryItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const queryKey = sp?.toString() ?? "";

  // reset when filters change
  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
  }, [initialItems, initialCursor]);

  const loadMore = useCallback(async () => {
    if (loading || !cursor) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(sp?.toString() ?? "");
      params.set("cursor", cursor);
      const res = await fetch(`/api/library?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: LibraryItem[];
        nextCursor: string | null;
      };
      setItems((prev) => {
        const seen = new Set(prev.map((p) => `${p.kind}:${p.id}`));
        const fresh = data.items.filter((i) => !seen.has(`${i.kind}:${i.id}`));
        return [...prev, ...fresh];
      });
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, sp]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const onCardClick = useCallback(
    (item: LibraryItem) => {
      router.push(detailHref(item));
    },
    [router],
  );

  if (items.length === 0) {
    return (
      <div className="lib-empty">
        <p className="lib-empty__title">Nothing in the library yet.</p>
        <p className="lib-empty__sub">
          Artifacts, deep research, and browser sessions you generate during chat
          will collect here.
        </p>
      </div>
    );
  }

  return (
    <div className="lib-stack">
      <div className="lib-meta">
        <span className="lib-meta__count">{totalLabel}</span>
        <span className="lib-meta__rule" aria-hidden />
        <span className="lib-meta__hint" suppressHydrationWarning>
          {/* deterministic */}
          showing {items.length}
        </span>
      </div>

      <div className="lib-grid" key={queryKey}>
        {items.map((item, i) => {
          const figNum = i + 1;
          return (
            <article
              key={`${item.kind}:${item.id}`}
              className="lib-card"
              onClick={() => onCardClick(item)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCardClick(item);
                }
              }}
            >
              <header className="lib-card__head">
                <span className="lib-card__num">
                  Fig.&nbsp;{String(figNum).padStart(2, "0")}
                </span>
                <span className="lib-card__rule" aria-hidden />
                <span className="lib-card__glyph">
                  <KindGlyph item={item} />
                </span>
              </header>

              <Link
                href={detailHref(item)}
                className="lib-card__title"
                onClick={(e) => e.stopPropagation()}
              >
                {item.title}
              </Link>

              {item.subtitle ? (
                <p className="lib-card__subtitle">{item.subtitle}</p>
              ) : null}

              <footer className="lib-card__foot">
                <span className="lib-card__type">
                  {typeLabel(item)}
                  {item.language ? (
                    <span className="lib-card__lang"> · {item.language}</span>
                  ) : null}
                </span>
                <span className="lib-card__sep" aria-hidden>
                  ·
                </span>
                <span className="lib-card__time" suppressHydrationWarning>
                  <em>{relativeTime(item.createdAt)}</em>
                </span>
                <span className="lib-card__arrow" aria-hidden>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </span>
              </footer>
            </article>
          );
        })}
      </div>

      {cursor ? (
        <div ref={sentinelRef} className="lib-sentinel">
          {loading ? "loading more…" : ""}
        </div>
      ) : (
        <div className="lib-sentinel lib-sentinel--end">end of archive</div>
      )}
    </div>
  );
}
