"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  conversationId: string;
  initialPrompt: string;
  onSaved: (next: string) => void;
};

export function SystemPromptEditor({ conversationId, initialPrompt, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialPrompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setValue(initialPrompt); }, [initialPrompt]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => textareaRef.current?.focus(), 0);
    function onClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = value.trim();
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: next === "" ? null : next }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "save failed");
      }
      onSaved(next);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  const dirty = value.trim() !== initialPrompt.trim();
  const active = initialPrompt.trim().length > 0;

  return (
    <div className="sysprompt-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`sysprompt-btn${active ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={active ? "system prompt set — click to edit" : "set system prompt"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6h16M4 12h10M4 18h7" />
        </svg>
        system
        {active && <span className="sysprompt-dot" aria-hidden />}
      </button>
      {open && (
        <div ref={popoverRef} className="sysprompt-popover" role="dialog" aria-label="system prompt">
          <div className="sysprompt-head">system prompt</div>
          <textarea
            ref={textareaRef}
            className="sysprompt-textarea"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="you are a concise assistant. respond in plain prose without filler."
            rows={8}
            spellCheck={false}
          />
          {error && <div className="sysprompt-error">{error}</div>}
          <div className="sysprompt-foot">
            <span className="sysprompt-hint">applies to every reply in this chat</span>
            <div className="sysprompt-actions">
              {active && (
                <button
                  type="button"
                  className="sysprompt-action sysprompt-action--ghost"
                  onClick={() => { setValue(""); }}
                  disabled={saving}
                >
                  clear
                </button>
              )}
              <button
                type="button"
                className="sysprompt-action sysprompt-action--ghost"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                cancel
              </button>
              <button
                type="button"
                className="sysprompt-action sysprompt-action--save"
                onClick={save}
                disabled={saving || !dirty}
              >
                {saving ? "saving…" : "save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
