"use client";

import { useEffect, useState } from "react";
import { useTextSelection } from "@/hooks/use-text-selection";

// Selection-driven action chips. Mount once near the top of the chat shell.
// Watches for text selections within message bubbles and shows a floating
// chip row above the selection with actions:
//
//   ⎘ Copy           → clipboard
//   ⌫ Quote-reply    → dispatches `composer:insert` event with kind=quote
//   ✦ Ask follow-up  → dispatches `composer:insert` event with kind=ask
//
// The composer parent (ChatThread) listens for these events and updates
// its input state — keeps SelectionChips decoupled from composer plumbing.

const HIDE_DELAY_MS = 100;

export function SelectionChips() {
  const sel = useTextSelection();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  // Position the chip row above the selection rect.
  useEffect(() => {
    if (!sel) {
      setPosition(null);
      setHidden(false);
      setCopied(false);
      return;
    }
    const r = sel.rect;
    setPosition({
      top: r.top + window.scrollY - 44,
      left: r.left + window.scrollX + r.width / 2,
    });
  }, [sel]);

  function dispatchInsert(kind: "quote" | "ask", text: string) {
    window.dispatchEvent(
      new CustomEvent("composer:insert", { detail: { kind, text } })
    );
    // Briefly hide chips so the user sees the composer update
    setHidden(true);
    setTimeout(() => setHidden(false), HIDE_DELAY_MS);
    // Clear selection
    window.getSelection()?.removeAllRanges();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {/* ignore */}
  }

  if (!sel || !position || hidden) return null;

  return (
    <div
      className="selection-chips"
      role="toolbar"
      aria-label="Selected text actions"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <button
        type="button"
        className="selection-chips__btn"
        onClick={() => copy(sel.text)}
        title="Copy selection"
      >
        {copied ? (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>copied</span>
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>copy</span>
          </>
        )}
      </button>

      <button
        type="button"
        className="selection-chips__btn"
        onClick={() => dispatchInsert("quote", sel.text)}
        title="Quote in reply"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 21h18" />
          <path d="M3 7h18" />
          <path d="M9 11v6" />
          <path d="M15 11v6" />
        </svg>
        <span>quote-reply</span>
      </button>

      <button
        type="button"
        className="selection-chips__btn selection-chips__btn--accent"
        onClick={() => dispatchInsert("ask", sel.text)}
        title="Ask a follow-up about this"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7" />
          <line x1="12" y1="17" x2="12" y2="17" />
        </svg>
        <span>ask follow-up</span>
      </button>
    </div>
  );
}
