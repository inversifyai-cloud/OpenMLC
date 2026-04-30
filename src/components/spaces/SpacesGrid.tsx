"use client";

import Link from "next/link";
import { useState } from "react";
import { NewSpaceForm } from "./NewSpaceForm";

export type SpaceCard = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  chatCount: number;
  fileCount: number;
  memoryCount: number;
  updatedAt: string; // ISO
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 24 * 3600_000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = {
  initialSpaces: SpaceCard[];
};

export function SpacesGrid({ initialSpaces }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const spaces = initialSpaces;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          type="button"
          className="spc-btn spc-btn--primary"
          onClick={() => setFormOpen((o) => !o)}
        >
          {formOpen ? "× close" : "+ new space"}
        </button>
      </div>

      <NewSpaceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />

      {spaces.length === 0 ? (
        <div className="spc-empty">
          <span className="spc-empty-title">no spaces yet</span>
          <span className="spc-empty-hint">
            create a space to bundle a project&rsquo;s prompt, files, memory, and chats.
            conversations outside any space remain at the root.
          </span>
          {!formOpen && (
            <button
              className="spc-btn spc-btn--primary"
              onClick={() => setFormOpen(true)}
              style={{ marginTop: 12 }}
            >
              + create your first space
            </button>
          )}
        </div>
      ) : (
        <div className="spc-grid" role="list">
          {spaces.map((s) => (
            <Link
              key={s.id}
              href={`/spaces/${s.id}`}
              className="spc-card"
              role="listitem"
              prefetch
            >
              <span className="spc-card-emoji" aria-hidden>
                {s.emoji || "◇"}
              </span>
              <span className="spc-card-body">
                <span className="spc-card-name">{s.name}</span>
                {s.description ? (
                  <span className="spc-card-desc">{s.description}</span>
                ) : (
                  <span className="spc-card-desc" style={{ color: "var(--fg-4)" }}>
                    untitled project
                  </span>
                )}
              </span>
              <span className="spc-card-meta">
                <span><b>{s.chatCount}</b> chats</span>
                <span>·</span>
                <span><b>{s.fileCount}</b> files</span>
                <span>·</span>
                <span suppressHydrationWarning>{shortDate(s.updatedAt)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
