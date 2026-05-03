"use client";

import { useState, useEffect } from "react";

type FocusLevel = "default" | "focus" | "zen";

function isFocusLevel(v: unknown): v is FocusLevel {
  return v === "default" || v === "focus" || v === "zen";
}

function loadFocusMode(): FocusLevel {
  if (typeof window === "undefined") return "default";
  try {
    const raw = localStorage.getItem("openmlc:focus-mode");
    if (raw && isFocusLevel(raw)) return raw;
  } catch {}
  return "default";
}

export function useFocusMode() {
  const [level, setLevel] = useState<FocusLevel>("default");

  // Initialize from localStorage
  useEffect(() => {
    setLevel(loadFocusMode());
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("openmlc:focus-mode", level);
    } catch {}
  }, [level]);

  // Set data-focus attribute on document root
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-focus", level);
  }, [level]);

  // Global keyboard listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+. cycles through levels
      if (isMeta && e.key === ".") {
        e.preventDefault();
        setLevel((prev) => {
          switch (prev) {
            case "default":
              return "focus";
            case "focus":
              return "zen";
            case "zen":
              return "default";
          }
        });
      }

      // Escape steps back one level (but only if not in default)
      if (e.key === "Escape" && level !== "default") {
        // Don't fire if focus is on textarea/input/contenteditable
        const target = e.target as HTMLElement;
        const isEditable =
          target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.contentEditable === "true";
        if (!isEditable) {
          e.preventDefault();
          setLevel((prev) => {
            switch (prev) {
              case "zen":
                return "focus";
              case "focus":
                return "default";
              case "default":
                return "default";
            }
          });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [level]);

  return {
    level,
    cycle: () => {
      setLevel((prev) => {
        switch (prev) {
          case "default":
            return "focus";
          case "focus":
            return "zen";
          case "zen":
            return "default";
        }
      });
    },
    stepBack: () => {
      setLevel((prev) => {
        switch (prev) {
          case "zen":
            return "focus";
          case "focus":
            return "default";
          case "default":
            return "default";
        }
      });
    },
    set: (newLevel: FocusLevel) => {
      setLevel(newLevel);
    },
  };
}
