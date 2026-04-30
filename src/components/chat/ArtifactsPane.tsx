"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface ArtifactData {
  id: string;
  type: "html" | "svg" | "code" | "markdown" | "react" | "mermaid" | "chart" | "research";
  language?: string | null;
  title: string;
  content: string;
  version: number;
  createdAt: string | Date;
  messageId: string;
  conversationId: string;
}

function sanitizeArtifactContent(raw: string): string {
  let s = raw.trim();
  const fenceWrap = /^```[a-zA-Z0-9_+-]*\s*\n([\s\S]*?)\n?```\s*$/;
  const m = fenceWrap.exec(s);
  if (m) s = m[1].trim();
  s = s.replace(/^```[a-zA-Z0-9_+-]*\s*\n?/, "");
  s = s.replace(/\n?```\s*$/, "");
  return s.trim();
}

function wrapMermaidDiagram(content: string, title: string): string {
  const safe = sanitizeArtifactContent(content);
  const escaped = safe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${title.replace(/[<>"']/g, "")}</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<style>
html,body{height:100%;margin:0;background:#fafaf7;font-family:system-ui,-apple-system,sans-serif;}
body{display:flex;align-items:center;justify-content:center;padding:24px;}
.mermaid{max-width:100%;}
</style>
</head>
<body>
<div class="mermaid">${escaped}</div>
<script>
mermaid.initialize({ startOnLoad: true, theme: "default", securityLevel: "loose" });
</script>
</body>
</html>`;
}

function wrapChart(content: string, title: string): string {
  const clean = sanitizeArtifactContent(content);
  const looksLikeJsx = /<\w+/.test(clean) || /function\s+App/.test(clean);
  if (looksLikeJsx) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${title.replace(/[<>"']/g, "")}</title>
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/recharts@2.15.0/umd/Recharts.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.25.6/babel.min.js"></script>
<style>html,body,#root{height:100%;margin:0;font-family:system-ui,-apple-system,sans-serif;}</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="env,react">
const { LineChart, BarChart, AreaChart, PieChart, Line, Bar, Area, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = window.Recharts;
${clean.replace(/^\s*import[^;]*;\s*/gm, "")}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
</script>
</body>
</html>`;
  }
  let spec: { type?: string; data?: unknown[]; xKey?: string; yKeys?: string[]; title?: string } = {};
  try { spec = JSON.parse(clean); } catch {}
  const safeSpec = JSON.stringify(spec).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${title.replace(/[<>"']/g, "")}</title>
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/recharts@2.15.0/umd/Recharts.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>html,body,#root{height:100%;margin:0;background:#fafaf7;font-family:system-ui,-apple-system,sans-serif;}#root{padding:20px;display:flex;flex-direction:column;}</style>
</head>
<body>
<div id="root"></div>
<script>
const spec = ${safeSpec};
const R = window.Recharts;
const { createElement: h } = React;
function ChartFor(spec) {
  const colors = ["#16a34a","#3b82f6","#f59e0b","#ef4444","#a855f7","#06b6d4"];
  const data = spec.data || [];
  const yKeys = spec.yKeys || [];
  const xKey = spec.xKey || "x";
  const Chart = ({ "line": R.LineChart, "bar": R.BarChart, "area": R.AreaChart, "pie": R.PieChart })[spec.type] || R.LineChart;
  if (spec.type === "pie") {
    return h(R.ResponsiveContainer, { width: "100%", height: "100%" },
      h(R.PieChart, null,
        h(R.Pie, { data, dataKey: yKeys[0] || "value", nameKey: xKey, cx: "50%", cy: "50%", outerRadius: 100, label: true },
          data.map((_, i) => h(R.Cell, { key: i, fill: colors[i % colors.length] }))
        ),
        h(R.Tooltip, null), h(R.Legend, null)
      ));
  }
  const Series = { "line": R.Line, "bar": R.Bar, "area": R.Area }[spec.type] || R.Line;
  return h(R.ResponsiveContainer, { width: "100%", height: "100%" },
    h(Chart, { data, margin: { top: 20, right: 24, left: 0, bottom: 8 } },
      h(R.CartesianGrid, { strokeDasharray: "3 3", stroke: "#e8e6df" }),
      h(R.XAxis, { dataKey: xKey, tick: { fontSize: 11 } }),
      h(R.YAxis, { tick: { fontSize: 11 } }),
      h(R.Tooltip, null), h(R.Legend, null),
      ...yKeys.map((k, i) => h(Series, { key: k, type: "monotone", dataKey: k, stroke: colors[i % colors.length], fill: colors[i % colors.length], fillOpacity: 0.4 }))
    ));
}
ReactDOM.createRoot(document.getElementById("root")).render(
  spec.title ? h("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
    h("h2", { style: { margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 600 } }, spec.title),
    h("div", { style: { flex: 1, minHeight: 0 } }, ChartFor(spec))
  ) : ChartFor(spec)
);
</script>
</body>
</html>`;
}

function wrapReactComponent(code: string, title: string): string {
  const clean = sanitizeArtifactContent(code);
  const stripped = clean.replace(/^\s*import[^;]*;\s*/gm, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title.replace(/[<>"']/g, "")}</title>
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.25.6/babel.min.js"></script>
<style>html,body,#root{height:100%;margin:0;font-family:system-ui,-apple-system,sans-serif;}</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="env,react">
${stripped}
const __mountRoot = document.getElementById("root");
ReactDOM.createRoot(__mountRoot).render(React.createElement(App));
</script>
</body>
</html>`;
}

interface ArtifactsPaneProps {
  artifact: ArtifactData | null;
  onClose: () => void;
  versions?: ArtifactData[];
}

type Tab = "preview" | "code" | "history";

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}

type DiffLine = { kind: "add" | "del" | "ctx"; text: string };

function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n"), b = newText.split("\n");
  const dp = lcs(a, b);
  const result: DiffLine[] = [];
  let i = a.length, j = b.length;
  const path: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      path.push({ kind: "ctx", text: a[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      path.push({ kind: "add", text: b[j - 1] }); j--;
    } else {
      path.push({ kind: "del", text: a[i - 1] }); i--;
    }
  }
  for (const line of path.reverse()) result.push(line);
  return result;
}

function extForType(type: ArtifactData["type"], language?: string | null): string {
  if (type === "html") return ".html";
  if (type === "svg") return ".svg";
  if (type === "markdown") return ".md";
  if (type === "react") return ".jsx";
  if (type === "mermaid") return ".mmd";
  if (type === "chart") return ".chart.json";
  if (type === "research") return ".json";
  return `.${language ?? "txt"}`;
}

type ResearchSource = { idx: number; title?: string; url?: string; snippet?: string };
type ResearchPayload = { answer: string; sources: ResearchSource[] };

function parseResearchPayload(raw: string): ResearchPayload {
  const trimmed = sanitizeArtifactContent(raw);
  try {
    const parsed = JSON.parse(trimmed);
    const answer = typeof parsed?.answer === "string" ? parsed.answer : "";
    const sources: ResearchSource[] = Array.isArray(parsed?.sources)
      ? parsed.sources
          .map((s: unknown, i: number) => {
            const o = (typeof s === "object" && s) ? s as Record<string, unknown> : {};
            return {
              idx: typeof o.idx === "number" ? o.idx : i + 1,
              title: typeof o.title === "string" ? o.title : undefined,
              url: typeof o.url === "string" ? o.url : undefined,
              snippet: typeof o.snippet === "string" ? o.snippet : undefined,
            } as ResearchSource;
          })
      : [];
    return { answer, sources };
  } catch {
    return { answer: trimmed, sources: [] };
  }
}

function getHostname(url?: string): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url.slice(0, 40); }
}

function ResearchView({ content }: { content: string }) {
  const { answer, sources } = useMemo(() => parseResearchPayload(content), [content]);
  const sourceRefs = useRef<Record<number, HTMLLIElement | null>>({});

  const scrollToSource = useCallback((idx: number) => {
    const el = sourceRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("research-source-flash");
      setTimeout(() => el.classList.remove("research-source-flash"), 1200);
    }
  }, []);

  const renderWithCites = useCallback((text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const re = /\[(\d+)\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const idx = Number(m[1]);
      parts.push(
        <sup key={`c-${key++}`}>
          <button
            type="button"
            className="research-cite-chip"
            onClick={() => scrollToSource(idx)}
            title={`Jump to source [${idx}]`}
          >
            [{idx}]
          </button>
        </sup>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }, [scrollToSource]);

  const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = useMemo(() => ({
    p: ({ children }) => {
      const processed = React.Children.map(children, (child) =>
        typeof child === "string" ? renderWithCites(child) : child
      );
      return <p style={{ margin: "8px 0", lineHeight: 1.65 }}>{processed}</p>;
    },
    li: ({ children }) => {
      const processed = React.Children.map(children, (child) =>
        typeof child === "string" ? renderWithCites(child) : child
      );
      return <li style={{ margin: "3px 0" }}>{processed}</li>;
    },
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer"
         style={{ color: "var(--fg-accent)", textDecoration: "underline", textUnderlineOffset: 3 }}>
        {children}
      </a>
    ),
    h1: ({ children }) => <h1 style={{ fontSize: 18, fontWeight: 600, margin: "14px 0 6px" }}>{children}</h1>,
    h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 600, margin: "12px 0 6px" }}>{children}</h2>,
    h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 500, margin: "10px 0 4px" }}>{children}</h3>,
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const isBlock = !!className?.startsWith("language-");
      if (isBlock) return <pre style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, padding: 10, background: "var(--bg-canvas)", border: "1px solid var(--stroke-1)", borderRadius: 6, overflow: "auto" }}><code>{children}</code></pre>;
      return <code className={className} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, padding: "1px 5px", background: "var(--bg-canvas)", borderRadius: 4 }}>{children}</code>;
    },
  }), [renderWithCites]);

  return (
    <div className="research-view" style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
      gap: 16,
      padding: 16,
      height: "100%",
      overflow: "hidden",
    }}>
      <div style={{
        overflow: "auto",
        paddingRight: 6,
        fontSize: 13,
        color: "var(--fg-1)",
        lineHeight: 1.65,
      }}>
        {answer ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{answer}</ReactMarkdown>
        ) : (
          <p style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
            (no answer body)
          </p>
        )}
      </div>
      <div style={{
        overflow: "auto",
        borderLeft: "1px solid var(--stroke-1)",
        paddingLeft: 14,
      }}>
        <div style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
          marginBottom: 10,
        }}>
          sources ({sources.length})
        </div>
        {sources.length === 0 ? (
          <p style={{ color: "var(--fg-4)", fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
            no sources cited
          </p>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {sources.map((s) => (
              <li
                key={s.idx}
                ref={(el) => { sourceRefs.current[s.idx] = el; }}
                style={{
                  border: "1px solid var(--stroke-1)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  background: "var(--bg-canvas)",
                  transition: "background 200ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--fg-accent)", fontWeight: 600 }}>
                    [{s.idx}]
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-1)", lineHeight: 1.4 }}>
                    {s.title ?? s.url ?? "untitled"}
                  </span>
                </div>
                {s.url && (
                  <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "var(--fg-3)", marginBottom: 4 }}>
                    {getHostname(s.url)}
                  </div>
                )}
                {s.snippet && (
                  <p style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.5, margin: "0 0 6px", fontStyle: "italic" }}>
                    &ldquo;{s.snippet}&rdquo;
                  </p>
                )}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 10,
                      color: "var(--fg-accent)",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    visit ↗
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function downloadArtifact(artifact: ArtifactData) {
  const ext = extForType(artifact.type, artifact.language);
  const blob = new Blob([artifact.content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${artifact.title.replace(/[^\w\s-]/g, "")}${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ArtifactsPane({ artifact, onClose, versions = [] }: ArtifactsPaneProps) {
  const [tab, setTab] = useState<Tab>("preview");
  const [selectedVersion, setSelectedVersion] = useState<ArtifactData | null>(null);
  const [copied, setCopied] = useState(false);

  const isOpen = !!artifact;

  const handleCopy = useCallback(async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [artifact]);

  const diffTarget = selectedVersion ?? (versions.length > 1 ? versions[versions.length - 2] : null);

  return (
    <div className={`artifacts-pane ${isOpen ? "open" : ""}`} role="complementary" aria-label="Artifact preview">

      <div className="artifacts-pane__header">
        <span className="artifacts-pane__title">{artifact?.title ?? "Artifact"}</span>
        {artifact && (
          <span className="artifacts-pane__badge">{artifact.type}{artifact.language ? ` · ${artifact.language}` : ""}</span>
        )}
        <div className="artifacts-pane__actions">
          <button className="artifacts-pane__btn" onClick={handleCopy} disabled={!artifact}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            className="artifacts-pane__btn"
            onClick={() => artifact && downloadArtifact(artifact)}
            disabled={!artifact}
          >
            Download
          </button>
        </div>
        <button className="artifacts-pane__close" onClick={onClose} aria-label="Close artifact pane">
          ×
        </button>
      </div>

      <div className="artifacts-pane__tabs">
        <button className={`artifacts-pane__tab ${tab === "preview" ? "active" : ""}`} onClick={() => setTab("preview")}>
          Preview
        </button>
        <button className={`artifacts-pane__tab ${tab === "code" ? "active" : ""}`} onClick={() => setTab("code")}>
          Code
        </button>
        <button className={`artifacts-pane__tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          History {versions.length > 0 ? `(${versions.length})` : ""}
        </button>
      </div>

      <div className="artifacts-pane__content">
        {tab === "preview" && artifact && (
          <>
            {artifact.type === "html" && (
              <iframe
                sandbox="allow-scripts allow-popups allow-modals allow-forms"
                srcDoc={sanitizeArtifactContent(artifact.content)}
                title={artifact.title}
              />
            )}
            {artifact.type === "react" && (
              <iframe
                sandbox="allow-scripts allow-popups allow-modals allow-forms"
                srcDoc={wrapReactComponent(artifact.content, artifact.title)}
                title={artifact.title}
              />
            )}
            {artifact.type === "mermaid" && (
              <iframe
                sandbox="allow-scripts"
                srcDoc={wrapMermaidDiagram(artifact.content, artifact.title)}
                title={artifact.title}
              />
            )}
            {artifact.type === "chart" && (
              <iframe
                sandbox="allow-scripts"
                srcDoc={wrapChart(artifact.content, artifact.title)}
                title={artifact.title}
              />
            )}
            {artifact.type === "svg" && (
              <div
                className="artifacts-pane__svg-wrap"

                dangerouslySetInnerHTML={{ __html: artifact.content }}
              />
            )}
            {artifact.type === "markdown" && (
              <div className="artifacts-pane__markdown">{artifact.content}</div>
            )}
            {artifact.type === "code" && (
              <pre>{artifact.content}</pre>
            )}
            {artifact.type === "research" && (
              <ResearchView content={artifact.content} />
            )}
          </>
        )}

        {tab === "code" && artifact && (
          <pre>{artifact.content}</pre>
        )}

        {tab === "history" && (
          <div className="artifacts-history">
            {versions.length === 0 ? (
              <p style={{ color: "var(--fg-3)", fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
                No version history yet.
              </p>
            ) : (
              <>
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`artifacts-history__item ${selectedVersion?.id === v.id ? "selected" : ""}`}
                    onClick={() => setSelectedVersion(selectedVersion?.id === v.id ? null : v)}
                  >
                    <div className="artifacts-history__meta">
                      v{v.version} · {new Date(v.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}

                {artifact && diffTarget && diffTarget.id !== artifact.id && (
                  <div className="artifacts-diff">
                    <div style={{ color: "var(--fg-3)", fontSize: 11, marginBottom: 8, fontFamily: "var(--font-mono, monospace)" }}>
                      Diff: v{diffTarget.version} → v{artifact.version}
                    </div>
                    {diffLines(diffTarget.content, artifact.content).map((line, i) => (
                      <div
                        key={i}
                        className={`artifacts-diff__${line.kind}`}
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      >
                        {line.kind === "add" ? "+ " : line.kind === "del" ? "- " : "  "}
                        {line.text}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
