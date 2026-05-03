"use client";

import { useEffect } from "react";

type Props = {
  current: number; // 1-based
  count: number;
  onPrev: () => void;
  onNext: () => void;
  // When true, [/] keyboard shortcuts cycle variants. Only one pager
  // should be `keyboard` at a time — typically the latest assistant turn.
  keyboard?: boolean;
};

export function VariantPager({ current, count, onPrev, onNext, keyboard }: Props) {
  // Keyboard support: `[` previous, `]` next.
  useEffect(() => {
    if (!keyboard) return;
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in an input/textarea/contenteditable
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "[" && current > 1) { e.preventDefault(); onPrev(); }
      else if (e.key === "]" && current < count) { e.preventDefault(); onNext(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyboard, current, count, onPrev, onNext]);

  if (count <= 1) return null;

  // Cap dots at 8 — beyond that show "current / count" with arrows only
  const showDots = count <= 8;

  return (
    <div className="variant-pager" role="group" aria-label="Response variants">
      <button
        type="button"
        className="variant-pager__btn"
        onClick={onPrev}
        disabled={current <= 1}
        aria-label="Previous variant"
        title={keyboard ? "Previous variant ([)" : "Previous variant"}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {showDots ? (
        <div className="variant-pager__dots" aria-live="polite">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={`variant-pager__dot${i + 1 === current ? " is-active" : ""}`}
              aria-hidden
            />
          ))}
        </div>
      ) : (
        <span className="variant-pager__count" aria-live="polite">
          {current} / {count}
        </span>
      )}

      <button
        type="button"
        className="variant-pager__btn"
        onClick={onNext}
        disabled={current >= count}
        aria-label="Next variant"
        title={keyboard ? "Next variant (])" : "Next variant"}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {showDots && (
        <span className="variant-pager__count variant-pager__count--small" aria-hidden>
          {current}/{count}
        </span>
      )}
    </div>
  );
}
