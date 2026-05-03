"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ScrollAnchorState {
  atBottom: boolean;
  hiddenLines: number;
  scrollToBottom: () => void;
}

const LINE_HEIGHT = 24; // approximate px per line

export function useScrollAnchor(ref: React.RefObject<HTMLElement | null>): ScrollAnchorState {
  const [atBottom, setAtBottom] = useState(true);
  const [hiddenLines, setHiddenLines] = useState(0);
  const rafIdRef = useRef<number>(0);

  const updateState = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const isAtBottom = distance < 80;
    setAtBottom(isAtBottom);

    // Approximate hidden lines below viewport
    const hidden = Math.max(0, Math.round(distance / LINE_HEIGHT));
    setHiddenLines(hidden);
  }, [ref]);

  // Passive scroll listener with rAF coalescing
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pending = false;

    const handleScroll = () => {
      if (!pending) {
        pending = true;
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          updateState();
          pending = false;
        });
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [ref, updateState]);

  // ResizeObserver for content growth during streaming
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        updateState();
      });
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [ref, updateState]);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [ref]);

  return {
    atBottom,
    hiddenLines,
    scrollToBottom,
  };
}
