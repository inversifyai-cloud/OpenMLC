"use client";

import { useEffect, useState } from "react";

export type SelectionInfo = {
  text: string;
  rect: DOMRect;
  // The closest enclosing element with a `data-message-id` attribute,
  // so we know which message the selection belongs to.
  messageId: string | null;
};

// Tracks the current text selection scoped to elements with `[data-message-id]`.
// Returns null when there's no selection, when it spans multiple messages, or
// when the selection is outside any message bubble (e.g. inside the composer).
//
// `rect` is the live bounding rect of the selection — recompute happens via
// the `selectionchange` event so callers can position UI relative to it.
export function useTextSelection(): SelectionInfo | null {
  const [info, setInfo] = useState<SelectionInfo | null>(null);

  useEffect(() => {
    let raf: number | null = null;

    function check() {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setInfo(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text || text.length < 2) {
        setInfo(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const start = range.startContainer.parentElement?.closest<HTMLElement>("[data-message-id]");
      const end = range.endContainer.parentElement?.closest<HTMLElement>("[data-message-id]");

      // Selection must be within exactly one message bubble
      if (!start || !end || start !== end) {
        setInfo(null);
        return;
      }
      const messageId = start.getAttribute("data-message-id");

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setInfo(null);
        return;
      }

      setInfo({ text, rect, messageId });
    }

    function onSelectionChange() {
      // Coalesce rapid changes into one rAF tick
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        check();
      });
    }

    document.addEventListener("selectionchange", onSelectionChange);
    // Also recompute on scroll/resize since the rect moves
    window.addEventListener("scroll", onSelectionChange, true);
    window.addEventListener("resize", onSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", onSelectionChange, true);
      window.removeEventListener("resize", onSelectionChange);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, []);

  return info;
}
