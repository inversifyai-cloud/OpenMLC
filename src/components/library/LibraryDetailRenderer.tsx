"use client";

import React, { useMemo, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ArtifactType =
  | "html"
  | "svg"
  | "code"
  | "markdown"
  | "react"
  | "mermaid"
  | "chart"
  | "research";

interface ArtifactPayload {
  id: string;
  title: string;
  type: ArtifactType;
  language?: string | null;
  content: string;
  version: number;
  createdAt: string;
  messageId: string;
  conversationId: string;
}

interface BrowserPayload {
  id: string;
  startUrl: string | null;
  status: string;
  steps: number;
  lastScreenshot: string | null;
  createdAt: string;
  closedAt: string | null;
}

type Props =
  | { kind: "artifact" | "research"; payload: ArtifactPayload; browser?: never }
  | { kind: "browser"; browser: BrowserPayload; payload?: never };

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
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title.replace(/[<>"']/g, "")}</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<style>html,body{height:100%;margin:0;background:#fafaf7;font-family:system-ui,sans-serif;}body{display:flex;align-items:center;justify-content:center;padding:24px;}.mermaid{max-width:100%;}</style>
</head><body><div class="mermaid">${escaped}</div>
<script>mermaid.initialize({startOnLoad:true,theme:"default",securityLevel:"loose"});</script></body></html>`;
}

function wrapChart(content: string, title: string): string {
  const clean = sanitizeArtifactContent(content);
  let spec: { type?: string; data?: unknown[]; xKey?: string; yKeys?: string[]; title?: string } = {};
  try { spec = JSON.parse(clean); } catch {}
  const safeSpec = JSON.stringify(spec).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title.replace(/[<>"']/g, "")}</title>
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/recharts@2.15.0/umd/Recharts.js"></script>
<style>html,body,#root{height:100%;margin:0;background:#fafaf7;font-family:system-ui,sans-serif;}#root{padding:20px;display:flex;flex-direction:column;}</style>
</head><body><div id="root"></div>
<script>
const spec = ${safeSpec};
const R = window.Recharts; const { createElement: h } = React;
function ChartFor(spec){const colors=["#16a34a","#3b82f6","#f59e0b","#ef4444","#a855f7","#06b6d4"];const data=spec.data||[];const yKeys=spec.yKeys||[];const xKey=spec.xKey||"x";const Chart=({line:R.LineChart,bar:R.BarChart,area:R.AreaChart,pie:R.PieChart})[spec.type]||R.LineChart;
if(spec.type==="pie"){return h(R.ResponsiveContainer,{width:"100%",height:"100%"},h(R.PieChart,null,h(R.Pie,{data,dataKey:yKeys[0]||"value",nameKey:xKey,cx:"50%",cy:"50%",outerRadius:100,label:true},data.map((_,i)=>h(R.Cell,{key:i,fill:colors[i%colors.length]}))),h(R.Tooltip,null),h(R.Legend,null)));}
const Series={line:R.Line,bar:R.Bar,area:R.Area}[spec.type]||R.Line;
return h(R.ResponsiveContainer,{width:"100%",height:"100%"},h(Chart,{data,margin:{top:20,right:24,left:0,bottom:8}},h(R.CartesianGrid,{strokeDasharray:"3 3",stroke:"#e8e6df"}),h(R.XAxis,{dataKey:xKey,tick:{fontSize:11}}),h(R.YAxis,{tick:{fontSize:11}}),h(R.Tooltip,null),h(R.Legend,null),...yKeys.map((k,i)=>h(Series,{key:k,type:"monotone",dataKey:k,stroke:colors[i%colors.length],fill:colors[i%colors.length],fillOpacity:0.4}))));}
ReactDOM.createRoot(document.getElementById("root")).render(spec.title?h("div",{style:{display:"flex",flexDirection:"column",height:"100%"}},h("h2",{style:{margin:0,marginBottom:12,fontSize:16,fontWeight:600}},spec.title),h("div",{style:{flex:1,minHeight:0}},ChartFor(spec))):ChartFor(spec));
</script></body></html>`;
}

function wrapReactComponent(code: string, title: string): string {
  const clean = sanitizeArtifactContent(code);
  const stripped = clean.replace(/^\s*import[^;]*;\s*/gm, "");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title.replace(/[<>"']/g, "")}</title>
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.25.6/babel.min.js"></script>
<style>html,body,#root{height:100%;margin:0;font-family:system-ui,sans-serif;}</style>
</head><body><div id="root"></div>
<script type="text/babel" data-presets="env,react">
${stripped}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
</script></body></html>`;
}

type ResearchSource = { idx: number; title?: string; url?: string; snippet?: string };
type ResearchPayload = { answer: string; sources: ResearchSource[] };

function parseResearchPayload(raw: string): ResearchPayload {
  const trimmed = sanitizeArtifactContent(raw);
  try {
    const parsed = JSON.parse(trimmed);
    const answer = typeof parsed?.answer === "string" ? parsed.answer : "";
    const sources: ResearchSource[] = Array.isArray(parsed?.sources)
      ? parsed.sources.map((s: unknown, i: number) => {
          const o = typeof s === "object" && s ? (s as Record<string, unknown>) : {};
          return {
            idx: typeof o.idx === "number" ? o.idx : i + 1,
            title: typeof o.title === "string" ? o.title : undefined,
            url: typeof o.url === "string" ? o.url : undefined,
            snippet: typeof o.snippet === "string" ? o.snippet : undefined,
          };
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
      el.classList.add("lib-research__source--flash");
      setTimeout(() => el.classList.remove("lib-research__source--flash"), 1200);
    }
  }, []);

  const renderWithCites = useCallback(
    (text: string): React.ReactNode => {
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
              className="lib-research__cite"
              onClick={() => scrollToSource(idx)}
            >
              [{idx}]
            </button>
          </sup>,
        );
        last = m.index + m[0].length;
      }
      if (last < text.length) parts.push(text.slice(last));
      return parts;
    },
    [scrollToSource],
  );

  const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = useMemo(
    () => ({
      p: ({ children }) => {
        const processed = React.Children.map(children, (child) =>
          typeof child === "string" ? renderWithCites(child) : child,
        );
        return <p>{processed}</p>;
      },
      li: ({ children }) => {
        const processed = React.Children.map(children, (child) =>
          typeof child === "string" ? renderWithCites(child) : child,
        );
        return <li>{processed}</li>;
      },
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    }),
    [renderWithCites],
  );

  return (
    <div className="lib-research">
      <div className="lib-research__answer">
        {answer ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {answer}
          </ReactMarkdown>
        ) : (
          <p className="lib-research__empty">no answer body</p>
        )}
      </div>
      <aside className="lib-research__sources">
        <div className="lib-research__heading">
          sources ({sources.length})
        </div>
        {sources.length === 0 ? (
          <p className="lib-research__empty">no sources cited</p>
        ) : (
          <ol className="lib-research__list">
            {sources.map((s) => (
              <li
                key={s.idx}
                ref={(el) => {
                  sourceRefs.current[s.idx] = el;
                }}
                className="lib-research__source"
              >
                <div className="lib-research__source-head">
                  <span className="lib-research__idx">[{s.idx}]</span>
                  <span className="lib-research__source-title">
                    {s.title ?? s.url ?? "untitled"}
                  </span>
                </div>
                {s.url ? (
                  <div className="lib-research__host">{getHostname(s.url)}</div>
                ) : null}
                {s.snippet ? (
                  <p className="lib-research__snippet">&ldquo;{s.snippet}&rdquo;</p>
                ) : null}
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lib-research__visit"
                  >
                    visit ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

function ArtifactBody({ payload }: { payload: ArtifactPayload }) {
  const { type, content, title } = payload;
  if (type === "html") {
    return (
      <iframe
        className="lib-iframe"
        sandbox="allow-scripts allow-popups allow-modals allow-forms"
        srcDoc={sanitizeArtifactContent(content)}
        title={title}
      />
    );
  }
  if (type === "react") {
    return (
      <iframe
        className="lib-iframe"
        sandbox="allow-scripts allow-popups allow-modals allow-forms"
        srcDoc={wrapReactComponent(content, title)}
        title={title}
      />
    );
  }
  if (type === "mermaid") {
    return (
      <iframe
        className="lib-iframe"
        sandbox="allow-scripts"
        srcDoc={wrapMermaidDiagram(content, title)}
        title={title}
      />
    );
  }
  if (type === "chart") {
    return (
      <iframe
        className="lib-iframe"
        sandbox="allow-scripts"
        srcDoc={wrapChart(content, title)}
        title={title}
      />
    );
  }
  if (type === "svg") {
    return (
      <div
        className="lib-svg"
        dangerouslySetInnerHTML={{ __html: sanitizeArtifactContent(content) }}
      />
    );
  }
  if (type === "markdown") {
    return (
      <div className="lib-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {sanitizeArtifactContent(content)}
        </ReactMarkdown>
      </div>
    );
  }
  if (type === "research") {
    return <ResearchView content={content} />;
  }
  return <pre className="lib-pre">{sanitizeArtifactContent(content)}</pre>;
}

function BrowserBody({ browser }: { browser: BrowserPayload }) {
  const screenshotSrc: string | null = null;
  const screenshotPath = browser.lastScreenshot;

  return (
    <div className="lib-browser">
      <div className="lib-browser__timeline">
        <div className="lib-browser__heading">timeline</div>
        <ol className="lib-browser__steps">
          <li>
            <span className="lib-browser__step-num">01</span>
            <span className="lib-browser__step-text">
              session opened
              {browser.startUrl ? (
                <>
                  {" "}
                  on{" "}
                  <a
                    href={browser.startUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lib-browser__url"
                  >
                    {browser.startUrl}
                  </a>
                </>
              ) : null}
            </span>
            <span className="lib-browser__step-time">
              {new Date(browser.createdAt).toLocaleString()}
            </span>
          </li>
          <li>
            <span className="lib-browser__step-num">02</span>
            <span className="lib-browser__step-text">
              {browser.steps} action step{browser.steps === 1 ? "" : "s"} executed
            </span>
            <span className="lib-browser__step-time">·</span>
          </li>
          {browser.closedAt ? (
            <li>
              <span className="lib-browser__step-num">03</span>
              <span className="lib-browser__step-text">
                session {browser.status}
              </span>
              <span className="lib-browser__step-time">
                {new Date(browser.closedAt).toLocaleString()}
              </span>
            </li>
          ) : (
            <li>
              <span className="lib-browser__step-num">03</span>
              <span className="lib-browser__step-text">
                still {browser.status}
              </span>
              <span className="lib-browser__step-time">—</span>
            </li>
          )}
        </ol>
      </div>

      <div className="lib-browser__screenshot">
        <div className="lib-browser__heading">last frame</div>
        {screenshotSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshotSrc}
            alt="last browser screenshot"
            className="lib-browser__img"
          />
        ) : (
          <div className="lib-browser__no-img">
            {screenshotPath ? (
              <span className="lib-browser__path">{screenshotPath}</span>
            ) : (
              "no screenshot captured"
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function LibraryDetailRenderer(props: Props) {
  if (props.kind === "browser") return <BrowserBody browser={props.browser} />;
  return <ArtifactBody payload={props.payload} />;
}
