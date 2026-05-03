"use client";

import { useEffect, useState } from "react";

type FocusLevel = "default" | "focus" | "zen";

function isFocusLevel(v: unknown): v is FocusLevel {
  return v === "default" || v === "focus" || v === "zen";
}

// ── Module-level singleton store ──────────────────────────────────────────
// All hook instances share one level value + one set of event listeners.
// This prevents the race where two mounted instances (TopRail + ChatThread)
// overwrite each other's data-focus attribute on every re-render.

let _level: FocusLevel = "default";
let _listeners: Set<(l: FocusLevel) => void> = new Set();
let _keyHandlerMounted = false;

function _applyLevel(level: FocusLevel) {
  _level = level;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("openmlc:focus-mode", level); } catch {}
    document.documentElement.setAttribute("data-focus", level);
  }
  _listeners.forEach((fn) => fn(level));
}

function _cycle() {
  _applyLevel(_level === "default" ? "focus" : _level === "focus" ? "zen" : "default");
}

function _stepBack() {
  _applyLevel(_level === "zen" ? "focus" : "default");
}

function _mountKeyHandler() {
  if (_keyHandlerMounted || typeof window === "undefined") return;
  _keyHandlerMounted = true;
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ".") {
      e.preventDefault();
      _cycle();
      return;
    }
    if (e.key === "Escape" && _level !== "default") {
      const t = e.target as HTMLElement;
      if (t.tagName !== "TEXTAREA" && t.tagName !== "INPUT" && t.contentEditable !== "true") {
        e.preventDefault();
        _stepBack();
      }
    }
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────
export function useFocusMode() {
  const [level, setLevel] = useState<FocusLevel>(_level);

  useEffect(() => {
    // Bootstrap from localStorage once
    if (_level === "default") {
      try {
        const raw = localStorage.getItem("openmlc:focus-mode");
        if (raw && isFocusLevel(raw) && raw !== "default") {
          _applyLevel(raw);
        }
      } catch {}
    } else {
      // Apply persisted level to the DOM in case this instance mounted late
      document.documentElement.setAttribute("data-focus", _level);
    }

    // Subscribe
    _listeners.add(setLevel);
    // Sync local state to current store value
    setLevel(_level);

    // Mount the keyboard handler exactly once across all instances
    _mountKeyHandler();

    return () => {
      _listeners.delete(setLevel);
    };
  }, []);

  return {
    level,
    cycle: _cycle,
    stepBack: _stepBack,
    set: _applyLevel,
  };
}
