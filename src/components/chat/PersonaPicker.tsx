"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Persona = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  systemPrompt: string;
  isDefault: boolean;
};

type Props = {
  conversationId: string;
  currentPersonaId: string | null;
  onChange: (personaId: string | null) => void;
};

export function PersonaPicker({ conversationId, currentPersonaId, onChange }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // close on outside click / escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function loadPersonas() {
    if (personas !== null || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/personas", { cache: "no-store" });
      if (!res.ok) throw new Error("failed to load");
      const data = (await res.json()) as { personas: Persona[] };
      setPersonas(data.personas ?? []);
    } catch {
      setError("could not load personas");
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) void loadPersonas();
  }

  async function pick(personaId: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personaId }),
      });
      if (!res.ok) throw new Error("failed to save");
      onChange(personaId);
      setOpen(false);
    } catch {
      setError("could not save");
    } finally {
      setSaving(false);
    }
  }

  const current = personas?.find((p) => p.id === currentPersonaId) ?? null;
  const chipEmoji = current?.emoji || (currentPersonaId ? "◆" : "○");
  const chipLabel = current?.name ?? (currentPersonaId ? "persona" : "no persona");

  return (
    <div className="reasoning-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`tool-pill${currentPersonaId ? " active" : ""}`}
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        title="choose persona"
        disabled={saving}
      >
        <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>{chipEmoji}</span>
        <span className="tool-pill-label-text">{chipLabel}</span>
      </button>

      {open && (
        <div
          className="reasoning-popover glass-strong"
          role="menu"
          aria-label="persona picker"
          style={{ minWidth: 280, maxWidth: 340 }}
        >
          <div className="reasoning-popover-head">persona</div>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentPersonaId === null}
            className={`reasoning-option${currentPersonaId === null ? " active" : ""}`}
            onClick={() => void pick(null)}
            disabled={saving}
          >
            <span className="reasoning-option-dot" aria-hidden />
            <span className="reasoning-option-label">none</span>
            <span className="reasoning-option-hint">no persona</span>
          </button>

          {loading && (
            <div className="reasoning-option" style={{ opacity: 0.6, cursor: "default" }}>
              <span className="reasoning-option-label">loading…</span>
            </div>
          )}

          {!loading && personas && personas.length === 0 && (
            <div className="reasoning-option" style={{ opacity: 0.7, cursor: "default" }}>
              <span className="reasoning-option-hint">no personas yet</span>
            </div>
          )}

          {!loading &&
            personas?.map((p) => {
              const isActive = p.id === currentPersonaId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`reasoning-option${isActive ? " active" : ""}`}
                  onClick={() => void pick(p.id)}
                  disabled={saving}
                  title={p.description ?? p.name}
                >
                  <span aria-hidden style={{ fontSize: 13, lineHeight: 1, width: 14, textAlign: "center" }}>
                    {p.emoji || "◆"}
                  </span>
                  <span className="reasoning-option-label" style={{ minWidth: 0, textTransform: "none", letterSpacing: 0 }}>
                    {p.name}
                  </span>
                  {p.description && (
                    <span
                      className="reasoning-option-hint"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 160,
                      }}
                    >
                      {p.description}
                    </span>
                  )}
                </button>
              );
            })}

          {error && (
            <div
              style={{
                padding: "6px 8px",
                fontSize: 11,
                color: "var(--signal-err)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              borderTop: "1px solid var(--stroke-1)",
              marginTop: 4,
              paddingTop: 4,
            }}
          >
            <Link
              href="/settings/personas"
              className="reasoning-option"
              style={{ textDecoration: "none" }}
              onClick={() => setOpen(false)}
            >
              <span className="reasoning-option-label" style={{ textTransform: "none", letterSpacing: 0 }}>
                manage personas →
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
