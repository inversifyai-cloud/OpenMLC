"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SpaceLite = { id: string; name: string; emoji: string | null };

type Props = {
  conversationId: string;
  initialSpace: SpaceLite | null;
};

export function SpacePill({ conversationId, initialSpace }: Props) {
  const router = useRouter();
  const [space, setSpace] = useState<SpaceLite | null>(initialSpace);
  const [open, setOpen] = useState(false);
  const [spaces, setSpaces] = useState<SpaceLite[] | null>(null);
  const [pending, setPending] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/spaces?light=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.spaces)) {
          setSpaces(
            d.spaces.map((s: SpaceLite & { archived?: boolean }) => ({
              id: s.id,
              name: s.name,
              emoji: s.emoji ?? null,
            })),
          );
        }
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function pick(nextId: string | null) {
    setPending(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spaceId: nextId }),
      });
      if (res.ok) {
        if (!nextId) {
          setSpace(null);
        } else {
          const found = spaces?.find((s) => s.id === nextId);
          if (found) setSpace(found);
        }
        setOpen(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (!space) {
    return (
      <div style={{ position: "relative" }} ref={popRef}>
        <button
          type="button"
          className="spc-pill"
          onClick={() => setOpen((o) => !o)}
          title="add to a space"
        >
          <em>+ add to space</em>
        </button>
        {open && (
          <SpacePopover
            spaces={spaces}
            currentId={null}
            onPick={pick}
            pending={pending}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }} ref={popRef}>
      <button
        type="button"
        className="spc-pill"
        onClick={() => setOpen((o) => !o)}
        title={`in ${space.name}`}
      >
        <span className="emoji" aria-hidden>{space.emoji || "◇"}</span>
        <span>in</span>
        <em>{space.name}</em>
      </button>
      {open && (
        <SpacePopover
          spaces={spaces}
          currentId={space.id}
          onPick={pick}
          pending={pending}
        />
      )}
    </div>
  );
}

function SpacePopover({
  spaces,
  currentId,
  onPick,
  pending,
}: {
  spaces: SpaceLite[] | null;
  currentId: string | null;
  onPick: (id: string | null) => void;
  pending: boolean;
}) {
  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        zIndex: 50,
        minWidth: 220,
        background: "var(--bg-elevated)",
        border: "var(--bw-1) solid var(--stroke-2)",
        borderRadius: "var(--r-3)",
        boxShadow: "var(--shadow-3)",
        padding: 4,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--t-caption)",
      }}
    >
      {spaces === null ? (
        <div style={{ padding: 10, color: "var(--fg-3)" }}>loading…</div>
      ) : spaces.length === 0 ? (
        <div style={{ padding: 10, color: "var(--fg-3)" }}>
          no spaces yet · <Link href="/spaces" style={{ color: "var(--fg-accent)" }}>create one</Link>
        </div>
      ) : (
        <>
          {spaces.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={pending}
              onClick={() => onPick(s.id)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                background: s.id === currentId ? "var(--surface-selected)" : "transparent",
                border: "none",
                color: "var(--fg-1)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
                textAlign: "left",
                borderRadius: "var(--r-2)",
              }}
            >
              <span style={{ fontFamily: "var(--font-sans)" }}>{s.emoji || "◇"}</span>
              <span>{s.name}</span>
              {s.id === currentId && (
                <span style={{ marginLeft: "auto", color: "var(--fg-3)" }}>current</span>
              )}
            </button>
          ))}
          <div style={{ borderTop: "var(--bw-hair) solid var(--stroke-1)", margin: "4px 0" }} />
          <button
            type="button"
            disabled={pending || currentId === null}
            onClick={() => onPick(null)}
            style={{
              display: "flex",
              width: "100%",
              padding: "6px 8px",
              background: "transparent",
              border: "none",
              color: "var(--fg-3)",
              cursor: currentId === null ? "default" : "pointer",
              fontFamily: "inherit",
              fontSize: "inherit",
              textAlign: "left",
              borderRadius: "var(--r-2)",
            }}
          >
            leave space (move to root)
          </button>
        </>
      )}
    </div>
  );
}
