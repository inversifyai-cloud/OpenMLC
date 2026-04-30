"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";

export type InboxEntryDTO = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  refType: string;
  refId: string;
  read: boolean;
  createdAt: string;
};

type Bucket = { label: string; rows: InboxEntryDTO[] };

function bucketize(rows: InboxEntryDTO[]): Bucket[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const today: InboxEntryDTO[] = [];
  const yesterday: InboxEntryDTO[] = [];
  const week: InboxEntryDTO[] = [];
  const older: InboxEntryDTO[] = [];
  for (const r of rows) {
    const age = now - new Date(r.createdAt).getTime();
    if (age < day) today.push(r);
    else if (age < 2 * day) yesterday.push(r);
    else if (age < 7 * day) week.push(r);
    else older.push(r);
  }
  const out: Bucket[] = [];
  if (today.length) out.push({ label: "today", rows: today });
  if (yesterday.length) out.push({ label: "yesterday", rows: yesterday });
  if (week.length) out.push({ label: "this week", rows: week });
  if (older.length) out.push({ label: "older", rows: older });
  return out;
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const KIND_LABEL: Record<string, string> = {
  workflow_run: "Workflow",
  swarm_run: "Swarm",
  research_done: "Research",
  browser_done: "Browser",
  schedule_fired: "Schedule",
};

function destinationFor(entry: InboxEntryDTO): string {
  switch (entry.refType) {
    case "conversation":
      return `/chat/${entry.refId}`;
    case "swarm_run":
      return `/swarm/${entry.refId}`;
    case "research_session":
      return `/library/research:${entry.refId}`;
    case "browser_session":
      return `/library/browser:${entry.refId}`;
    case "workflow_run":
      return `/settings/workflows`;
    default:
      return "/inbox";
  }
}

function KindGlyph({ kind }: { kind: string }) {
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
  switch (kind) {
    case "workflow_run":
      // clock — workflow / scheduled run
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "swarm_run":
      // three triangles — swarm of agents
      return (
        <svg {...common}>
          <path d="M5 17 8 11l3 6Z" />
          <path d="M13 17l3-6 3 6Z" />
          <path d="M9 9 12 3l3 6Z" />
        </svg>
      );
    case "research_done":
      // magnifier
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m21 21-5.5-5.5" />
        </svg>
      );
    case "browser_done":
      // globe
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
    case "schedule_fired":
      // cron tick — staggered diamonds
      return (
        <svg {...common}>
          <path d="M4 8h4M4 12h7M4 16h4" />
          <path d="m14 11 3 3 5-5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

export function InboxList({ initialEntries }: { initialEntries: InboxEntryDTO[] }) {
  const [entries, setEntries] = useState<InboxEntryDTO[]>(initialEntries);

  const buckets = useMemo(() => bucketize(entries), [entries]);

  const markRead = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, read: true } : e)),
    );
    // fire and forget; failures won't unwind navigation
    fetch(`/api/inbox/${encodeURIComponent(id)}/read`, { method: "PATCH" }).catch(() => {});
  }, []);

  if (entries.length === 0) {
    return (
      <div className="ibx-empty">
        <span className="ibx-empty__fig" aria-hidden>§</span>
        <p className="ibx-empty__title">Nothing here yet.</p>
        <p className="ibx-empty__sub">
          <em>Async work — finished research, swarm runs, and scheduled jobs — will land here.</em>
        </p>
      </div>
    );
  }

  return (
    <div className="ibx-feed">
      {buckets.map((bucket, bi) => (
        <section key={bucket.label} className="ibx-bucket" data-bucket={bucket.label}>
          <header className="ibx-bucket__head">
            <span className="ibx-bucket__num">§ {String(bi + 1).padStart(2, "0")}</span>
            <span className="ibx-bucket__label">{bucket.label}</span>
            <span className="ibx-bucket__rule" aria-hidden />
            <span className="ibx-bucket__count">{bucket.rows.length}</span>
          </header>
          <ul className="ibx-rows">
            {bucket.rows.map((row) => {
              const href = destinationFor(row);
              const kindLabel = KIND_LABEL[row.kind] ?? row.kind;
              return (
                <li key={row.id} className={`ibx-row ${row.read ? "" : "ibx-row--unread"}`}>
                  <Link
                    href={href}
                    prefetch={false}
                    className="ibx-row__link"
                    onClick={() => {
                      if (!row.read) markRead(row.id);
                    }}
                  >
                    <span className="ibx-row__dot" aria-hidden>
                      {!row.read ? <span className="ibx-row__dot-mark" /> : null}
                    </span>
                    <span className="ibx-row__glyph" aria-hidden>
                      <KindGlyph kind={row.kind} />
                    </span>
                    <span className="ibx-row__kind">{kindLabel}</span>
                    <span className="ibx-row__divider" aria-hidden>/</span>
                    <span className="ibx-row__title">{row.title}</span>
                    {row.summary ? (
                      <span className="ibx-row__summary">
                        <em>{row.summary}</em>
                      </span>
                    ) : null}
                    <span className="ibx-row__time" suppressHydrationWarning>
                      <em>{relTime(row.createdAt)}</em>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
