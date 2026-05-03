"use client";

import { useEffect, useState } from "react";
import { highlightToHtml } from "@/lib/highlight/shiki";
import { useCopy } from "@/hooks/use-copy";

type Props = {
  code: string;
  lang: string;
  filename?: string;
  streaming: boolean;
};

const COLLAPSE_THRESHOLD_LINES = 22;

function detectTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function CodeBlock({ code, lang, filename, streaming }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => detectTheme());
  const [wrap, setWrap] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { copy, copied } = useCopy();

  // React to theme changes (data-theme on <html>)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => setTheme(detectTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  // Run Shiki only after streaming completes (avoid mid-stream re-paint thrash)
  useEffect(() => {
    if (streaming) return;
    let cancelled = false;
    (async () => {
      const out = await highlightToHtml(code, lang, theme).catch(() => null);
      if (!cancelled) setHtml(out);
    })();
    return () => { cancelled = true; };
  }, [code, lang, theme, streaming]);

  const lineCount = code.split("\n").length;
  const showCollapseControl = lineCount > COLLAPSE_THRESHOLD_LINES;
  const displayLang = lang || "text";

  return (
    <div className={`code-block${wrap ? " is-wrap" : ""}${collapsed ? " is-collapsed" : ""}`}>
      <div className="code-block__header">
        <span className="code-block__lang">{displayLang}</span>
        {filename && <span className="code-block__filename">{filename}</span>}
        <div className="code-block__actions">
          {showCollapseControl && (
            <button
              type="button"
              className="code-block__btn"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expand" : "Collapse"}
              aria-label={collapsed ? "Expand code block" : "Collapse code block"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 180ms" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className={`code-block__btn${wrap ? " is-active" : ""}`}
            onClick={() => setWrap((w) => !w)}
            title={wrap ? "Disable line wrap" : "Wrap long lines"}
            aria-label="Toggle line wrap"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 6 21 6" />
              <path d="M3 12h15a3 3 0 1 1 0 6h-4" />
              <polyline points="16 16 14 18 16 20" />
              <line x1="3" y1="20" x2="11" y2="20" />
            </svg>
          </button>
          <button
            type="button"
            className={`code-block__btn code-block__copy${copied ? " is-copied" : ""}`}
            onClick={() => void copy(code)}
            title={copied ? "Copied!" : "Copy code"}
            aria-label="Copy code"
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            <span className="code-block__copy-label">{copied ? "copied" : "copy"}</span>
          </button>
        </div>
      </div>

      {!collapsed && (
        html && !streaming ? (
          <div
            className="code-block__body code-block__body--shiki"
            // shiki returns a sanitized <pre><code>...</code></pre> tree
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="code-block__body" data-lang={displayLang}>
            <code>{code}</code>
          </pre>
        )
      )}

      {collapsed && (
        <div className="code-block__collapsed-hint">
          {lineCount} lines collapsed — click ▾ to expand
        </div>
      )}
    </div>
  );
}
