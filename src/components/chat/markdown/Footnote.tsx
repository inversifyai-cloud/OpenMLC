"use client";

import { useState, useRef, useEffect } from "react";

type FootnoteProps = {
  id: string;
  children: React.ReactNode;
  content?: React.ReactNode;
};

export function Footnote({ id, children, content }: FootnoteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current || !tooltipRef.current) return;

    // Position tooltip relative to trigger
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Try to position below; if it overflows, position above
    const top = triggerRect.bottom + 8;
    const willOverflow = top + tooltipRect.height > viewportHeight;
    const finalTop = willOverflow ? triggerRect.top - tooltipRect.height - 8 : top;

    setPosition({
      top: finalTop,
      left: triggerRect.left,
    });
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="md-footnote-trigger"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        title={`Footnote ${id}`}
        aria-label={`Footnote ${id}`}
        style={{
          display: "inline",
          fontSize: "0.85em",
          verticalAlign: "super",
          color: "var(--fg-accent)",
          cursor: "pointer",
          margin: "0 2px",
          padding: "0 3px",
          border: "none",
          background: "transparent",
          textDecoration: "underline",
          transition: "opacity 140ms ease",
        }}
      >
        [{id}]
      </button>

      {isOpen && content && position && (
        <div
          ref={tooltipRef}
          className="md-footnote-tooltip"
          style={{
            position: "fixed",
            top: `${position.top}px`,
            left: `${position.left}px`,
            background: "var(--bg-elevated)",
            border: "1px solid var(--stroke-2)",
            borderRadius: "var(--r-2)",
            padding: "8px 12px",
            fontSize: "12px",
            color: "var(--fg-1)",
            zIndex: 1000,
            maxWidth: "300px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            animation: "fadeIn 140ms ease",
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
