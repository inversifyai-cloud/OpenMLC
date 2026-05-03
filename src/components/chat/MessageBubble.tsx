"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useMemo, useState, useEffect } from "react";
import { getModel } from "@/lib/providers/registry";
import { isImage } from "@/lib/mime";
import type { ChatAttachment } from "@/types/chat";
import { TtsButton } from "./TtsButton";
import { ArtifactInline } from "./ArtifactInline";
import { extractArtifacts, type ExtractedArtifact } from "@/lib/artifacts/extract";
import { useSmoothedText } from "@/hooks/use-smoothed-text";
import { CodeBlock } from "./CodeBlock";
import { ModelAvatar } from "./ModelAvatar";
import { VariantPager } from "./VariantPager";

type MdComponents = React.ComponentProps<typeof ReactMarkdown>["components"];

// Module-level flag to guard lazy KaTeX CSS import
let katexCssLoaded = false;

// Wraps streaming markdown with token-rate smoothing — text appears at a steady
// CPS rate even though tokens arrive in bursts. When streaming ends, it snaps to
// the full text instantly.
function StreamingMarkdown({ text, streaming, components }: { text: string; streaming: boolean; components: MdComponents }) {
  const smoothed = useSmoothedText(text, streaming);

  // Lazy-load KaTeX CSS only when needed
  useEffect(() => {
    if (typeof window !== "undefined" && !katexCssLoaded && /\$/.test(text)) {
      katexCssLoaded = true;
      import("katex/dist/katex.min.css").catch(() => {});
    }
  }, [text]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {smoothed}
    </ReactMarkdown>
  );
}

export type ArtifactRef = {
  id: string;
  title: string;
  type: "html" | "svg" | "code" | "markdown" | "react" | "mermaid" | "chart" | "research";
  language?: string | null;
  content: string;
};

function stripArtifactTags(input: string): string {
  return input.replace(/<artifact\s+[^>]*>[\s\S]*?<\/artifact>/gi, "").trim();
}

function liveArtifactsFromText(text: string, messageId: string | undefined): ArtifactRef[] {
  if (!text || !messageId) return [];
  const extracted: ExtractedArtifact[] = extractArtifacts(text);
  return extracted.map((a, i) => ({
    id: `live-${messageId}-${i}`,
    title: a.title,
    type: a.type,
    language: a.language ?? null,
    content: a.content,
  }));
}

type TextPart      = { type: "text"; text: string };
type ReasoningPart = { type: "reasoning"; text: string };
type StepStartPart = { type: "step-start" };
type SourceUrlPart = { type: "source-url"; sourceId: string; url: string; title?: string };
type ToolPart = {
  type: string;
  toolName?: string;
  toolCallId?: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export type AnyPart =
  | TextPart | ReasoningPart | StepStartPart | SourceUrlPart | ToolPart | { type: string };

const TOOL_LABELS: Record<string, string> = {
  web_search:     "web search",
  url_read:       "read url",
  kb_search:      "knowledge base",
  code_exec:      "run code",
  generate_image: "generate image",
  image_gen:      "generate image",
  remember:       "saved memory",
  browser_navigate: "browser → navigate",
  browser_click:    "browser → click",
  browser_type:     "browser → type",
  browser_press:    "browser → press",
  browser_scroll:   "browser → scroll",
  browser_back:     "browser → back",
  browser_forward:  "browser → forward",
  browser_extract:  "browser → extract",
  computer_screenshot:      "computer → screenshot",
  computer_click:           "computer → click",
  computer_double_click:    "computer → double click",
  computer_move:            "computer → move",
  computer_scroll:          "computer → scroll",
  computer_drag:            "computer → drag",
  computer_type:            "computer → type",
  computer_key:             "computer → key",
  computer_bash:            "computer → shell",
  computer_file_read:       "computer → read file",
  computer_file_write:      "computer → write file",
  computer_file_list:       "computer → list files",
  computer_file_delete:     "computer → delete file",
  computer_clipboard_read:  "computer → clipboard read",
  computer_clipboard_write: "computer → clipboard write",
  computer_launch_app:           "computer → launch app",
  computer_system_info:          "computer → system info",
  computer_screenshot_region:    "computer → zoom screenshot",
  computer_accessibility_tree:   "computer → accessibility tree",
  computer_find_text:            "computer → find text",
  computer_ocr:                  "computer → ocr",
  computer_screen_diff:          "computer → screen diff",
  computer_run_script:           "computer → run script",
  computer_cursor_position:      "computer → cursor position",
};

function resolveToolName(part: ToolPart): string {
  if (part.type === "dynamic-tool" && part.toolName) return part.toolName;
  if (part.type.startsWith("tool-")) return part.type.slice(5);
  return part.toolName ?? "tool";
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

function isMcpTool(rawName: string): boolean {
  return rawName.includes("__");
}

function mcpDisplayName(name: string): string {
  const parts = name.split("__");
  return parts[parts.length - 1].replace(/_/g, " ");
}

function isToolPart(p: AnyPart): p is ToolPart {
  return p.type === "dynamic-tool" || p.type.startsWith("tool-");
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url.slice(0, 30); }
}

function getHint(rawName: string, input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  switch (rawName) {
    case "web_search": return `"${String(i.query ?? "").slice(0, 55)}"`;
    case "url_read": {
      try { return new URL(String(i.url ?? "")).hostname.replace(/^www\./, ""); }
      catch { return String(i.url ?? "").slice(0, 40); }
    }
    case "kb_search":  return `"${String(i.query ?? "").slice(0, 55)}"`;
    case "code_exec":  return String(i.language ?? "");
    default: return null;
  }
}

function getOutputMeta(rawName: string, output: unknown): { text: string; cls: "ok" | "err" | "" } | null {
  if (output === null || output === undefined) return null;
  const o = typeof output === "object" ? output as Record<string, unknown> : {};
  switch (rawName) {
    case "web_search": {
      const n = Array.isArray(o.results) ? o.results.length : 0;
      return { text: `${n} result${n !== 1 ? "s" : ""}`, cls: n > 0 ? "ok" : "" };
    }
    case "url_read":
      return { text: o.title ? String(o.title).slice(0, 40) : "fetched", cls: "ok" };
    case "kb_search":
      return { text: "retrieved", cls: "ok" };
    case "code_exec": {
      const code = Number(o.exitCode ?? 0);
      return { text: `exit ${code}`, cls: code === 0 ? "ok" : "err" };
    }
    default: return { text: "done", cls: "ok" };
  }
}

function WebSearchResults({ output }: { output: unknown }) {
  const o = typeof output === "object" && output ? output as Record<string, unknown> : {};
  const results = (Array.isArray(o.results) ? o.results : []) as Array<{
    title?: string; url?: string; content?: string;
  }>;
  if (!results.length) return <p style={{ color: "var(--fg-4)", fontSize: 12, margin: 0 }}>no results</p>;
  return (
    <div>
      {results.map((r, i) => (
        <div key={i} className="web-result">
          <div className="web-result-top">
            <span className="web-result-title">{r.title ?? "untitled"}</span>
            <span className="web-result-domain">{r.url ? getDomain(r.url) : ""}</span>
          </div>
          <p className="web-result-snippet">{String(r.content ?? "")}</p>
        </div>
      ))}
    </div>
  );
}

function CodeExecOutput({ output, input }: { output: unknown; input?: unknown }) {
  const o = typeof output === "object" && output ? output as Record<string, unknown> : {};
  const inp = typeof input === "object" && input ? input as Record<string, unknown> : {};
  const lang = String(inp.language ?? "");
  const exitCode = Number(o.exitCode ?? 0);
  const stdout = String(o.stdout ?? "").trim();
  const stderr = String(o.stderr ?? "").trim();
  const dur = o.durationMs ? `${(Number(o.durationMs) / 1000).toFixed(2)}s` : null;
  const isOk = exitCode === 0;
  return (
    <>
      <div className="code-exec-bar">
        {lang && <span className="code-exec-lang">{lang}</span>}
        {dur && <><span className="code-exec-sep">·</span><span>{dur}</span></>}
        <span className={`code-exec-exit ${isOk ? "ok" : "err"}`}>exit {exitCode}</span>
      </div>
      <div className="code-exec-body">
        {stdout && (
          <>
            <div className="code-exec-section-label">stdout</div>
            <div>{stdout}</div>
          </>
        )}
        {stderr && (
          <>
            {stdout && <div style={{ borderTop: "1px solid var(--stroke-1)", margin: "8px 0" }} />}
            <div className="code-exec-section-label" style={{ color: "var(--signal-err)" }}>stderr</div>
            <div style={{ color: "var(--signal-err)" }}>{stderr}</div>
          </>
        )}
        {!stdout && !stderr && <div style={{ color: "var(--fg-4)", fontStyle: "italic" }}>(no output)</div>}
      </div>
    </>
  );
}

function UrlReadOutput({ output }: { output: unknown }) {
  const o = typeof output === "object" && output ? output as Record<string, unknown> : {};
  const title = String(o.title ?? "");
  const url = String(o.url ?? "");
  const body = String(o.text ?? "");
  return (
    <div>
      {title && <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-2)", marginBottom: 4 }}>{title}</div>}
      {url && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {url}
        </div>
      )}
      {body && <p style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{body}</p>}
    </div>
  );
}

function KbSearchOutput({ output }: { output: unknown }) {
  const o = typeof output === "object" && output ? output as Record<string, unknown> : {};
  const chunks = Array.isArray(o.chunks)
    ? (o.chunks as Array<{ content?: string; filename?: string }>)
    : [];
  if (!chunks.length) {
    return <p style={{ fontSize: 12, color: "var(--fg-3)", margin: 0 }}>{String(o.text ?? output ?? "").slice(0, 600)}</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {chunks.map((c, i) => (
        <div key={i} style={{ padding: "7px 10px", background: "var(--bg-canvas)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-2)" }}>
          {c.filename && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)", marginBottom: 3, letterSpacing: "0.06em" }}>
              {c.filename}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.55, margin: 0 }}>{String(c.content ?? "")}</p>
        </div>
      ))}
    </div>
  );
}

function GenericToolOutput({ output }: { output: unknown }) {
  let text: string;
  try { text = JSON.stringify(output, null, 2); } catch { text = String(output); }
  return (
    <pre style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55, margin: 0 }}>
      {text}
    </pre>
  );
}

function BrowserToolOutput({ output, rawName }: { output: unknown; rawName: string }) {
  const o = typeof output === "object" && output ? (output as Record<string, unknown>) : {};
  const screenshot = typeof o.screenshot === "string" ? o.screenshot : null;
  const screenshotPath = typeof o.screenshotPath === "string" ? o.screenshotPath : null;
  const url = typeof o.url === "string" ? o.url : "";
  const title = typeof o.title === "string" ? o.title : "";
  const text = typeof o.text === "string" ? o.text : "";
  const imgSrc = screenshot || screenshotPath;
  const action = rawName.replace(/^browser_/, "");
  return (
    <div>
      {imgSrc && (
        <div style={{ marginBottom: 6, border: "1px solid var(--stroke-2)", borderRadius: "var(--r-2)", overflow: "hidden", background: "var(--bg-canvas)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={`browser ${action} screenshot`}
            style={{ display: "block", width: "100%", maxHeight: 400, objectFit: "contain" }}
          />
        </div>
      )}
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-3)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-4)" }}>{action}</span>
        {title && <span style={{ color: "var(--fg-2)" }}>{title.slice(0, 80)}</span>}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--fg-accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
            {url}
          </a>
        )}
      </div>
      {text && (
        <pre style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5, maxHeight: 240, overflow: "auto", background: "var(--bg-canvas)", padding: 8, borderRadius: "var(--r-2)", border: "1px solid var(--stroke-1)" }}>
          {text.slice(0, 4000)}
        </pre>
      )}
    </div>
  );
}

function ComputerToolOutput({ output, rawName }: { output: unknown; rawName: string }) {
  const o = typeof output === "object" && output ? (output as Record<string, unknown>) : {};
  const screenshotPath = typeof o.screenshotPath === "string" ? o.screenshotPath : null;
  const isScript = rawName === "computer_bash" || rawName === "computer_run_script";
  const stdout = typeof o.stdout === "string" ? o.stdout : null;
  const stderr = typeof o.stderr === "string" ? o.stderr : null;
  const exitCode = typeof o.exitCode === "number" ? o.exitCode : null;
  const content = typeof o.content === "string" ? o.content : null;
  const entries = Array.isArray(o.entries) ? (o.entries as Array<{ name: string; type: string; size: number }>) : null;
  const text = typeof o.text === "string" ? o.text : null;

  // New tool outputs
  const changePercent = typeof o.changePercent === "number" ? o.changePercent : null;
  const matches = Array.isArray(o.matches) ? (o.matches as Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>) : null;
  const blocks = Array.isArray(o.blocks) ? (o.blocks as Array<{ text: string; x: number; y: number }>) : null;
  const fullText = typeof o.fullText === "string" ? o.fullText : null;
  const tree = o.tree != null ? o.tree : null;
  const cursorX = typeof o.x === "number" ? o.x : null;
  const cursorY = typeof o.y === "number" ? o.y : null;

  const action = rawName.replace(/^computer_/, "");
  const PRE: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5, maxHeight: 240, overflow: "auto", background: "var(--bg-canvas)", padding: 8, borderRadius: "var(--r-2)", border: "1px solid var(--stroke-1)", marginTop: 4 };

  return (
    <div>
      {screenshotPath && (
        <div style={{ marginBottom: 6, border: "1px solid var(--stroke-2)", borderRadius: "var(--r-2)", overflow: "hidden", background: "var(--bg-canvas)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshotPath} alt={`computer ${action}`} style={{ display: "block", width: "100%", maxHeight: 400, objectFit: "contain" }} />
        </div>
      )}
      {changePercent !== null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: changePercent < 1 ? "var(--signal-err)" : "var(--green-500)", marginTop: 4 }}>
          {changePercent < 1 ? "no change detected" : `${changePercent}% of screen changed`}
        </div>
      )}
      {isScript && (stdout !== null || stderr !== null) && (
        <pre style={{ ...PRE, color: exitCode === 0 ? "var(--fg-2)" : "var(--signal-err)" }}>
          {stdout ? stdout.slice(0, 8000) : ""}
          {stderr ? `\n[stderr]\n${stderr.slice(0, 2000)}` : ""}
        </pre>
      )}
      {content !== null && <pre style={PRE}>{content.slice(0, 8000)}</pre>}
      {entries !== null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {entries.slice(0, 50).map((e, i) => (
            <span key={i} style={{ color: e.type === "directory" ? "var(--fg-accent)" : "var(--fg-3)", background: "var(--bg-canvas)", border: "1px solid var(--stroke-1)", borderRadius: "var(--r-1)", padding: "2px 6px" }}>
              {e.type === "directory" ? "/" : ""}{e.name}
            </span>
          ))}
          {entries.length > 50 && <span style={{ color: "var(--fg-4)" }}>+{entries.length - 50} more</span>}
        </div>
      )}
      {matches !== null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 4 }}>
          {matches.length === 0
            ? <span style={{ color: "var(--fg-4)" }}>no matches found</span>
            : matches.slice(0, 10).map((m, i) => (
                <div key={i} style={{ color: "var(--fg-2)", marginBottom: 2 }}>
                  <span style={{ color: "var(--fg-accent)" }}>&ldquo;{m.text}&rdquo;</span>
                  {" "}at ({m.x}, {m.y}) — {Math.round(m.confidence * 100)}% confidence
                </div>
              ))
          }
        </div>
      )}
      {fullText !== null && blocks !== null && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginBottom: 4 }}>{blocks.length} text blocks found</div>
          <pre style={PRE}>{fullText.slice(0, 4000)}</pre>
        </div>
      )}
      {tree !== null && (
        <pre style={{ ...PRE, maxHeight: 320, fontSize: 10 }}>{JSON.stringify(tree, null, 2).slice(0, 12000)}</pre>
      )}
      {cursorX !== null && cursorY !== null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>
          cursor at ({cursorX}, {cursorY})
        </div>
      )}
      {text !== null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>
          {text.slice(0, 200)}
        </div>
      )}
      {!screenshotPath && !isScript && !matches && !blocks && !tree && cursorX === null && changePercent === null && content === null && entries === null && text === null && (
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{action}</div>
      )}
    </div>
  );
}

function ImageGenOutput({ output }: { output: unknown }) {
  const data = output as { url?: string; prompt?: string; attachmentId?: string } | null;
  if (!data?.url) return <GenericToolOutput output={output} />;
  return (
    <figure style={{ margin: 0 }}>
      <img
        src={data.url}
        alt={data.prompt ?? "Generated image"}
        style={{
          display: "block",
          maxWidth: "100%",
          height: "auto",
          borderRadius: "var(--r-3)",
          border: "1px solid var(--stroke-2)",
        }}
      />
      {data.prompt ? (
        <figcaption
          style={{
            marginTop: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--fg-3)",
            lineHeight: 1.5,
          }}
        >
          {data.prompt}
        </figcaption>
      ) : null}
    </figure>
  );
}

type TlStatus = "idle" | "active" | "done" | "error";

function TimelineNode({
  label,
  hint,
  meta,
  metaCls = "",
  status,
  isMcp,
  children,
}: {
  label: string;
  hint?: string | null;
  meta?: string | null;
  metaCls?: "ok" | "err" | "";
  status: TlStatus;
  isMcp?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const hasBody = !!children;

  return (
    <div className={`tl-node${open && hasBody ? " open" : ""}`}>
      <div
        className={`tl-row${hasBody ? " clickable" : ""}`}
        onClick={() => hasBody && setOpen((v) => !v)}
      >
        <span className={`tl-stem ${status}`} aria-hidden />
        {isMcp && <span className="tl-mcp">mcp</span>}
        <span className="tl-label">{label}</span>
        {hint && <span className="tl-hint">{hint}</span>}
        {meta && <span className={`tl-meta${metaCls ? ` ${metaCls}` : ""}`}>{meta}</span>}
        {hasBody && (
          <svg className="tl-chevron" width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </div>
      {open && hasBody && (
        <div className="tl-body">{children}</div>
      )}
    </div>
  );
}

function ThinkingNode({ part, streaming }: { part: ReasoningPart; streaming?: boolean }) {
  const chars = part.text.length;
  const status: TlStatus = streaming ? "active" : "done";
  return (
    <TimelineNode
      label="thinking"
      meta={`${chars.toLocaleString()} chars`}
      status={status}
    >
      <div className="tl-thinking-text">{part.text}</div>
    </TimelineNode>
  );
}

function ToolNode({ part, streaming }: { part: ToolPart; streaming?: boolean }) {
  const rawName = resolveToolName(part);
  const mcp = isMcpTool(rawName);
  const displayName = mcp ? mcpDisplayName(rawName) : rawName;
  const label = toolLabel(displayName);

  const isDone = part.state === "output-available" || part.state === "output-error";
  const isError = part.state === "output-error";

  const status: TlStatus = isError ? "error" : isDone ? "done" : streaming ? "active" : "idle";
  const hint = getHint(rawName, part.input);
  const outputMeta = isDone && !isError ? getOutputMeta(rawName, part.output) : null;
  const meta = isError
    ? "failed"
    : outputMeta?.text ?? (isDone ? "done" : null);
  const metaCls = isError ? "err" : outputMeta?.cls ?? "";

  let body: React.ReactNode = null;
  if (isDone && !isError && part.output != null) {
    switch (rawName) {
      case "web_search":  body = <WebSearchResults output={part.output} />; break;
      case "code_exec":   body = <CodeExecOutput output={part.output} input={part.input} />; break;
      case "url_read":    body = <UrlReadOutput output={part.output} />; break;
      case "kb_search":   body = <KbSearchOutput output={part.output} />; break;
      case "image_gen":   body = <ImageGenOutput output={part.output} />; break;
      case "generate_image": body = <ImageGenOutput output={part.output} />; break;
      default:
        if (rawName.startsWith("browser_")) {
          body = <BrowserToolOutput output={part.output} rawName={rawName} />;
        } else if (rawName.startsWith("computer_")) {
          body = <ComputerToolOutput output={part.output} rawName={rawName} />;
        } else {
          body = <GenericToolOutput output={part.output} />;
        }
        break;
    }
  } else if (isError) {
    body = (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--signal-err)" }}>
        {part.errorText ?? "unknown error"}
      </div>
    );
  } else if (!isDone && part.input != null) {
    let inputText: string;
    try { inputText = JSON.stringify(part.input, null, 2); } catch { inputText = String(part.input); }
    body = (
      <pre style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", whiteSpace: "pre-wrap", margin: 0 }}>
        {inputText}
      </pre>
    );
  }

  const wrappedBody = body;

  return (
    <TimelineNode
      label={label}
      hint={hint}
      meta={meta}
      metaCls={metaCls as "ok" | "err" | ""}
      status={status}
      isMcp={mcp}
    >
      {wrappedBody}
    </TimelineNode>
  );
}

function SourceChips({ parts }: { parts: AnyPart[] }) {
  const sources = parts.filter((p): p is SourceUrlPart => p.type === "source-url");
  if (!sources.length) return null;
  return (
    <div className="source-chips">
      <span className="source-chips-label">sources</span>
      {sources.map((s, i) => (
        <a key={s.sourceId ?? i} href={s.url} target="_blank" rel="noopener noreferrer" className="source-chip">
          {getDomain(s.url)}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      ))}
    </div>
  );
}

// Pull the raw text out of whatever ReactMarkdown handed us as `children`.
// For fenced blocks, this is typically a single string in an array.
function childrenToString(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToString).join("");
  if (children && typeof children === "object" && "props" in children) {
    const c = (children as { props?: { children?: React.ReactNode } }).props?.children;
    return childrenToString(c);
  }
  return "";
}

// `language-ts file=foo.ts` → { lang: "ts", filename: "foo.ts" }
function parseLangSpec(className: string | undefined): { lang: string; filename?: string } {
  const raw = (className ?? "").replace(/^language-/, "").trim();
  if (!raw) return { lang: "" };
  const [lang, ...rest] = raw.split(/\s+/);
  const fileTag = rest.find((p) => p.startsWith("file="));
  return { lang, filename: fileTag?.slice("file=".length) || undefined };
}

function buildMD(streaming: boolean): React.ComponentProps<typeof ReactMarkdown>["components"] {
  return {
  pre: ({ children }) => {
    // ReactMarkdown wraps fenced blocks in <pre><code class="language-x">...</code></pre>.
    // We unwrap and route to <CodeBlock> so we can own the chrome + highlighting.
    if (children && typeof children === "object" && "props" in children) {
      const codeProps = (children as { props?: { className?: string; children?: React.ReactNode } }).props;
      const { lang, filename } = parseLangSpec(codeProps?.className);
      const code = childrenToString(codeProps?.children).replace(/\n$/, "");
      return <CodeBlock code={code} lang={lang} filename={filename} streaming={streaming} />;
    }
    return <pre>{children}</pre>;
  },
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    // Only inline code reaches here in practice (block code is intercepted by `pre` above).
    const isBlock = !!className?.startsWith("language-");
    if (isBlock) {
      const { lang, filename } = parseLangSpec(className);
      const code = childrenToString(children).replace(/\n$/, "");
      return <CodeBlock code={code} lang={lang} filename={filename} streaming={streaming} />;
    }
    return <code className={className}>{children}</code>;
  },
  p: ({ children }) => <p>{children}</p>,
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table className="md-table">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ padding: "6px 12px", textAlign: "left", borderBottom: "1px solid var(--stroke-2)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-3)", fontWeight: 500 }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--stroke-1)", color: "var(--fg-1)", verticalAlign: "top" }}>{children}</td>
  ),
  h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 600, margin: "16px 0 8px", color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{children}</h1>,
  h2: ({ children }) => <h2 className="md-heading" style={{ fontSize: 16, fontWeight: 600, margin: "14px 0 6px", color: "var(--fg-1)" }}>{children}</h2>,
  h3: ({ children }) => <h3 className="md-heading" style={{ fontSize: 14, fontWeight: 500, margin: "12px 0 4px", color: "var(--fg-1)" }}>{children}</h3>,
  ul: ({ children }) => <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.7 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.7 }}>{children}</ol>,
  li: ({ children }) => {
    // Detect GFM task lists: check if first child is <input type="checkbox">
    const childArray = Array.isArray(children) ? children : [children];
    const firstChild = childArray[0];
    const isTaskList = firstChild && typeof firstChild === "object" && "props" in firstChild &&
      (firstChild as { type?: string; props?: { type?: string } }).type === "input" &&
      (firstChild as { type?: string; props?: { type?: string } }).props?.type === "checkbox";

    if (isTaskList) {
      return (
        <li className="md-task-li" style={{ margin: "4px 0" }}>
          {children}
        </li>
      );
    }
    return (
      <li className="md-li" style={{ margin: "2px 0", color: "var(--fg-1)" }}>
        {children}
      </li>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="md-blockquote">
      {children}
    </blockquote>
  ),
  hr: () => <hr style={{ border: 0, borderTop: "1px solid var(--stroke-1)", margin: "16px 0" }} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="md-link"
      style={{ color: "var(--fg-accent)", textDecoration: "underline", textUnderlineOffset: 3 }}>
      {children}
    </a>
  ),
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) => (

    <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="msg-attachment-img" style={{ display: "block", marginTop: 8 }} />
  ),
  };
}

type Props = {
  role: "user" | "assistant" | "system";
  parts?: AnyPart[];
  text: string;
  modelId?: string | null;
  streaming?: boolean;
  createdAt?: string;
  profileMonogram?: string;
  profileDisplayName?: string;
  attachments?: ChatAttachment[];
  reasoning?: string | null;
  messageId?: string;
  onBranch?: (messageId: string) => void;
  artifacts?: ArtifactRef[];
  onOpenArtifact?: (artifact: ArtifactRef) => void;
  /* edit-feature */
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  superseded?: boolean;
  /* reroll-feature: assistant-only callbacks + pager state */
  onReroll?: (messageId: string) => void;
  variants?: {
    count: number;
    current: number; // 1-based for display
    onPrev: () => void;
    onNext: () => void;
  };
};

function fmtTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function MessageBubble({
  role, parts, text, modelId, streaming, createdAt,
  profileMonogram, profileDisplayName, attachments, reasoning,
  messageId, onBranch, artifacts, onOpenArtifact,
  onEdit, superseded, /* edit-feature */
  onReroll, variants, /* reroll-feature */
}: Props) {
  const isUser = role === "user";
  // Streaming-aware markdown component map. Code blocks defer Shiki tokenization
  // until streaming completes, then swap in highlighted HTML.
  const isStreaming = !!streaming && !isUser;
  const md = useMemo(() => buildMD(isStreaming), [isStreaming]);
  /* edit-feature: inline edit state for user messages */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const liveArtifacts = !isUser ? liveArtifactsFromText(text, messageId) : [];
  const dbArtifacts = artifacts ?? [];
  const renderArtifacts: ArtifactRef[] =
    dbArtifacts.length > 0 ? dbArtifacts : liveArtifacts;
  const cleanText = !isUser && renderArtifacts.length > 0 ? stripArtifactTags(text) : text;
  const model = modelId ? getModel(modelId) : null;
  const modelName = model?.name?.toLowerCase() ?? modelId ?? null;
  const modelShort = modelId
    ? (modelId.split("/").pop()?.split(":")[0]?.slice(0, 22) ?? null)
    : null;

  const imageAttachments = attachments?.filter((a) => isImage(a.mimeType)) ?? [];
  const fileAttachments  = attachments?.filter((a) => !isImage(a.mimeType)) ?? [];

  const processParts = parts?.filter(
    (p) => p.type === "reasoning" || isToolPart(p)

  ) ?? [];

  const textParts = (parts?.filter((p) => p.type === "text") as TextPart[] | undefined) ?? [];

  const hasLiveReasoning = parts?.some((p) => p.type === "reasoning") ?? false;
  const syntheticReasoning = !hasLiveReasoning && reasoning ? reasoning : null;

  const hasRichParts = processParts.length > 0 || textParts.length > 0;

  return (
    <div className="msg-wrap" data-message-id={messageId ?? undefined} data-role={role}>
      <div className="msg">
        {isUser ? (
          <div className="avatar you">{(profileMonogram ?? "·").slice(0, 3)}</div>
        ) : (
          <ModelAvatar
            modelId={modelId}
            providerId={model?.providerId}
            state={streaming ? "stream" : "idle"}
          />
        )}

        <div className="body">
          <div className="body-head" suppressHydrationWarning>
            <span className="name">{isUser ? (profileDisplayName ?? "you") : (modelName ?? "assistant")}</span>
            {!isUser && modelShort && <span className="model-chip" suppressHydrationWarning>{modelShort}</span>}
            <span className="meta" suppressHydrationWarning>
              {fmtTime(createdAt)}
              {streaming && <>{createdAt ? " · " : ""}<span className="live">live</span></>}
            </span>
            {!streaming && messageId && onBranch && (
              <button
                type="button"
                className="branch-btn"
                onClick={() => onBranch(messageId)}
                title="Branch conversation from here"
                aria-label="Branch conversation from this message"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="6" y1="3" x2="6" y2="15"/>
                  <circle cx="18" cy="6" r="3"/>
                  <circle cx="6" cy="18" r="3"/>
                  <path d="M18 9a9 9 0 0 1-9 9"/>
                </svg>
                branch
              </button>
            )}
            {/* reroll-feature: re-run this assistant turn */}
            {!isUser && !streaming && messageId && onReroll && (
              <button
                type="button"
                className="branch-btn"
                onClick={() => onReroll(messageId)}
                title="Reroll this response"
                aria-label="Reroll this assistant response"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15A9 9 0 1 1 18 6.36L23 10"/>
                </svg>
                reroll
              </button>
            )}
            {/* edit-feature: edit button for the user's own past messages */}
            {isUser && !streaming && !superseded && messageId && onEdit && !editing && (
              <button
                type="button"
                className="branch-btn"
                onClick={() => {
                  setDraft(text);
                  setEditError(null);
                  setEditing(true);
                }}
                title="Edit this message"
                aria-label="Edit this message"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
                edit
              </button>
            )}
            {!isUser && !streaming && messageId && text.trim().length > 0 && (
              // TODO: read Profile.ttsAutoPlay and pass through as autoPlay prop
              <TtsButton messageId={messageId} text={text} />
            )}
          </div>

          {imageAttachments.length > 0 && (
            <div className="msg-attachments" style={{ marginBottom: 10 }}>
              {imageAttachments.map((att) => (

                <img key={att.id} src={`/api/attachments/${att.id}`} alt={att.filename} className="msg-attachment-img" />
              ))}
            </div>
          )}

          {fileAttachments.length > 0 && (
            <div className="msg-attachments" style={{ marginBottom: 10 }}>
              {fileAttachments.map((att) => (
                <div key={att.id} className="msg-attachment-file">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  {att.filename}
                </div>
              ))}
            </div>
          )}

          <div className={`text${superseded ? " msg-superseded" : ""}`}>
            {isUser ? (
              editing && onEdit && messageId ? (
                /* edit-feature: inline editor */
                <div>
                  <textarea
                    className="msg-edit-textarea"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditing(false);
                        setEditError(null);
                      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = draft.trim();
                        if (!trimmed || saving) return;
                        setSaving(true);
                        setEditError(null);
                        onEdit(messageId, trimmed)
                          .then(() => {
                            setEditing(false);
                          })
                          .catch((err: unknown) => {
                            setEditError(err instanceof Error ? err.message : "edit failed");
                          })
                          .finally(() => setSaving(false));
                      }
                    }}
                    rows={Math.min(20, Math.max(2, draft.split("\n").length + 1))}
                    autoFocus
                    disabled={saving}
                    aria-label="Edit message"
                  />
                  <div className="msg-edit-actions">
                    <button
                      type="button"
                      className="branch-btn"
                      onClick={() => {
                        setEditing(false);
                        setEditError(null);
                      }}
                      disabled={saving}
                    >
                      cancel
                    </button>
                    <button
                      type="button"
                      className="branch-btn primary"
                      onClick={() => {
                        const trimmed = draft.trim();
                        if (!trimmed || saving) return;
                        setSaving(true);
                        setEditError(null);
                        onEdit(messageId, trimmed)
                          .then(() => {
                            setEditing(false);
                          })
                          .catch((err: unknown) => {
                            setEditError(err instanceof Error ? err.message : "edit failed");
                          })
                          .finally(() => setSaving(false));
                      }}
                      disabled={saving || !draft.trim()}
                    >
                      {saving ? "saving…" : "save"}
                    </button>
                    {editError && (
                      <span className="msg-edit-error">{editError}</span>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{text}</p>
              )
            ) : (
              <>

                {(processParts.length > 0 || syntheticReasoning) && (
                  <div className="msg-timeline">

                    {syntheticReasoning && (
                      <TimelineNode label="thinking" meta={`${syntheticReasoning.length.toLocaleString()} chars`} status="done">
                        <div className="tl-thinking-text">{syntheticReasoning}</div>
                      </TimelineNode>
                    )}
                    {processParts.map((part, i) => {
                      if (part.type === "reasoning") {
                        return <ThinkingNode key={i} part={part as ReasoningPart} streaming={streaming} />;
                      }
                      if (isToolPart(part)) {
                        return <ToolNode key={i} part={part} streaming={streaming} />;
                      }
                      return null;
                    })}
                  </div>
                )}

                {hasRichParts ? (
                  textParts.length > 0 ? (
                    <>
                      {textParts.map((part, i) => {
                        const partText = !isUser && renderArtifacts.length > 0
                          ? stripArtifactTags(part.text)
                          : part.text;
                        if (!partText.trim()) return null;
                        const isLastTextPart = i === textParts.length - 1;
                        const smoothThis = !!streaming && !isUser && isLastTextPart;
                        return (
                          <div key={i} style={i > 0 ? { marginTop: 8 } : undefined}>
                            <StreamingMarkdown text={partText} streaming={smoothThis} components={md} />
                          </div>
                        );
                      })}
                    </>
                  ) : null
                ) : (

                  cleanText.trim() ? (
                    <StreamingMarkdown text={cleanText} streaming={!!streaming && !isUser} components={md} />
                  ) : null
                )}

                {!isUser && renderArtifacts.length > 0 && onOpenArtifact && (
                  <div className="artifact-fig-stack">
                    {renderArtifacts.map((a, i) => (
                      <ArtifactInline
                        key={a.id}
                        artifact={a}
                        index={i}
                        onOpen={() => onOpenArtifact(a)}
                      />
                    ))}
                  </div>
                )}

                {parts && <SourceChips parts={parts} />}

                {streaming && <span className="cursor" />}

                {!streaming && variants && variants.count > 1 && (
                  <VariantPager
                    current={variants.current}
                    count={variants.count}
                    onPrev={variants.onPrev}
                    onNext={variants.onNext}
                    keyboard
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
