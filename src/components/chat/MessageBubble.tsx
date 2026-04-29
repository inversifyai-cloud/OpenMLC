"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { getModel } from "@/lib/providers/registry";
import { isImage } from "@/lib/mime";
import type { ChatAttachment } from "@/types/chat";

// ── Part-level types (AI SDK v6) ──────────────────────────────────────────────
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

// ── Tool helpers ──────────────────────────────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  web_search:     "web search",
  url_read:       "read url",
  kb_search:      "knowledge base",
  code_exec:      "run code",
  generate_image: "generate image",
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

// ── Per-tool: input hint & output meta (right-aligned) ───────────────────────
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

// ── Output body renderers ─────────────────────────────────────────────────────
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

// ── TimelineNode — one process step ──────────────────────────────────────────
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
        <span className={`tl-dot ${status}`} />
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

// ── Build a TimelineNode from a reasoning part ────────────────────────────────
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

// ── Build a TimelineNode from a tool part ─────────────────────────────────────
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
      default:            body = <GenericToolOutput output={part.output} />; break;
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

  // code_exec output needs flush padding (bar goes edge-to-edge)
  const isCodeExecDone = rawName === "code_exec" && isDone && !isError;
  const wrappedBody = isCodeExecDone
    ? <div style={{ border: "1px solid var(--stroke-1)", borderRadius: "var(--r-2)", overflow: "hidden" }}>{body}</div>
    : body;

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

// ── Source chips ──────────────────────────────────────────────────────────────
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

// ── Markdown renderer ─────────────────────────────────────────────────────────
const MD: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  pre: ({ children }) => <pre>{children}</pre>,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = !!className?.startsWith("language-");
    const lang = className?.replace("language-", "") ?? "";
    if (isBlock) return <pre data-lang={lang || undefined}><code>{children}</code></pre>;
    return <code className={className}>{children}</code>;
  },
  p: ({ children }) => <p>{children}</p>,
  table: ({ children }) => (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ padding: "6px 12px", textAlign: "left", borderBottom: "1px solid var(--stroke-2)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-3)", fontWeight: 500 }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--stroke-1)", color: "var(--fg-1)", verticalAlign: "top" }}>{children}</td>
  ),
  h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 600, margin: "16px 0 8px", color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 600, margin: "14px 0 6px", color: "var(--fg-1)" }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 500, margin: "12px 0 4px", color: "var(--fg-1)" }}>{children}</h3>,
  ul: ({ children }) => <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.7 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.7 }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: "2px 0", color: "var(--fg-1)" }}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote style={{ margin: "12px 0", paddingLeft: 14, borderLeft: "2px solid var(--stroke-2)", color: "var(--fg-3)", fontStyle: "italic" }}>{children}</blockquote>
  ),
  hr: () => <hr style={{ border: 0, borderTop: "1px solid var(--stroke-1)", margin: "16px 0" }} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: "var(--fg-accent)", textDecoration: "underline", textUnderlineOffset: 3 }}>
      {children}
    </a>
  ),
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="msg-attachment-img" style={{ display: "block", marginTop: 8 }} />
  ),
};

// ── Main component ────────────────────────────────────────────────────────────
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
};

function fmtTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function MessageBubble({
  role, parts, text, modelId, streaming, createdAt,
  profileMonogram, profileDisplayName, attachments, reasoning,
  messageId, onBranch,
}: Props) {
  const isUser = role === "user";
  const model = modelId ? getModel(modelId) : null;
  const modelName = model?.name?.toLowerCase() ?? modelId ?? null;
  const modelShort = modelId
    ? (modelId.split("/").pop()?.split(":")[0]?.slice(0, 22) ?? null)
    : null;

  const imageAttachments = attachments?.filter((a) => isImage(a.mimeType)) ?? [];
  const fileAttachments  = attachments?.filter((a) => !isImage(a.mimeType)) ?? [];

  // Separate into process parts (timeline) and text parts (response body)
  const processParts = parts?.filter(
    (p) => p.type === "reasoning" || isToolPart(p)
    // skip step-start — timeline itself provides separation
  ) ?? [];

  const textParts = (parts?.filter((p) => p.type === "text") as TextPart[] | undefined) ?? [];

  // For DB-loaded messages that have no live parts, synthetic reasoning
  const hasLiveReasoning = parts?.some((p) => p.type === "reasoning") ?? false;
  const syntheticReasoning = !hasLiveReasoning && reasoning ? reasoning : null;

  // Combined text for simple render (no parts at all)
  const hasRichParts = processParts.length > 0 || textParts.length > 0;

  return (
    <div className="msg-wrap">
      <div className="msg">
        {isUser ? (
          <div className="avatar you">{(profileMonogram ?? "·").slice(0, 3)}</div>
        ) : (
          <div className="avatar ai">M·L</div>
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
          </div>

          {/* Image attachments */}
          {imageAttachments.length > 0 && (
            <div className="msg-attachments" style={{ marginBottom: 10 }}>
              {imageAttachments.map((att) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={att.id} src={`/api/attachments/${att.id}`} alt={att.filename} className="msg-attachment-img" />
              ))}
            </div>
          )}

          {/* File attachments */}
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

          {/* Content */}
          <div className="text">
            {isUser ? (
              <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{text}</p>
            ) : (
              <>
                {/* ── Process timeline ── */}
                {(processParts.length > 0 || syntheticReasoning) && (
                  <div className="msg-timeline">
                    {/* DB-loaded reasoning injected as synthetic node */}
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

                {/* ── Text response ── */}
                {hasRichParts ? (
                  textParts.length > 0 ? (
                    <>
                      {textParts.map((part, i) => {
                        if (!part.text.trim()) return null;
                        return (
                          <div key={i} style={i > 0 ? { marginTop: 8 } : undefined}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{part.text}</ReactMarkdown>
                          </div>
                        );
                      })}
                    </>
                  ) : null
                ) : (
                  // No parts at all — fall back to plain text render
                  text.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{text}</ReactMarkdown>
                  ) : null
                )}

                {/* Source citations */}
                {parts && <SourceChips parts={parts} />}

                {streaming && <span className="cursor" />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
