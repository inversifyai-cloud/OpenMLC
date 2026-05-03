"use client";

import { useEffect, useRef, useState } from "react";

type Return = {
  restore: () => void;
  clear: () => void;
  hasDraft: boolean;
};

export function useDraft(
  conversationId: string,
  current: string,
  onRestore: (text: string) => void
): Return {
  const [hasDraft, setHasDraft] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const draftKey = `openmlc:draft:${conversationId}`;

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved && !current) {
      setHasDraft(true);
    }
  }, [conversationId, draftKey]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (current.trim()) {
        localStorage.setItem(draftKey, current);
      } else {
        localStorage.removeItem(draftKey);
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [current, draftKey]);

  function restore(): void {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      onRestore(saved);
      localStorage.removeItem(draftKey);
      setHasDraft(false);
    }
  }

  function clear(): void {
    localStorage.removeItem(draftKey);
    setHasDraft(false);
  }

  return { restore, clear, hasDraft };
}
