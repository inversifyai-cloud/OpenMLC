"use client";

import { useEffect, useRef, useState } from "react";
import { ModelPicker } from "./ModelPicker";
import { MicButton } from "./MicButton";
import { isImage } from "@/lib/mime";
import { getModel } from "@/lib/providers/registry";

export type PendingAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  uploading?: boolean;
};

export type ReasoningEffort = "off" | "low" | "medium" | "high";

const REASONING_LEVELS: { value: ReasoningEffort; label: string; hint: string }[] = [
  { value: "off",    label: "off",  hint: "no thinking budget" },
  { value: "low",    label: "low",  hint: "quick reflection" },
  { value: "medium", label: "med",  hint: "balanced reasoning" },
  { value: "high",   label: "high", hint: "deep deliberation" },
];

const SHORT_LABEL: Record<ReasoningEffort, string> = {
  off: "off",
  low: "low",
  medium: "med",
  high: "high",
};

type Status = "ready" | "submitted" | "streaming" | "error";

type Props = {
  modelId: string;
  onModelChange: (modelId: string) => void;
  status: Status;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  pendingAttachments: PendingAttachment[];
  onFileSelect: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
  reasoningEffort: ReasoningEffort;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  swarmMode?: boolean;
  onSwarmToggle?: (active: boolean) => void;
};

export function ChatComposer({
  modelId,
  onModelChange,
  status,
  input,
  onInputChange,
  onSubmit,
  onStop,
  pendingAttachments,
  onFileSelect,
  onRemoveAttachment,
  reasoningEffort,
  onReasoningEffortChange,
  swarmMode = false,
  onSwarmToggle,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reasoningWrapRef = useRef<HTMLDivElement | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  // Close reasoning popover on outside click / escape.
  useEffect(() => {
    if (!reasoningOpen) return;
    function onDoc(e: MouseEvent) {
      const wrap = reasoningWrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setReasoningOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setReasoningOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [reasoningOpen]);

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    // Swarm mode accepts plain Enter OR Cmd/Ctrl+Enter
    const isSwarmTrigger = swarmMode && (e.metaKey || e.ctrlKey);
    const isNormalSend = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (isNormalSend || isSwarmTrigger) {
      e.preventDefault();
      if (status !== "submitted" && status !== "streaming" && canSend) {
        onSubmit();
      }
    }
  }

  const busy = status === "submitted" || status === "streaming";
  const hasReadyAttachments = pendingAttachments.some((a) => !a.uploading);
  const canSend = !busy && (input.trim().length > 0 || hasReadyAttachments);
  const placeholder = swarmMode
    ? "describe the question for the swarm · enter or ⌘↵ to dispatch"
    : "message · enter to send";

  const supportsReasoning = !!getModel(modelId)?.capabilities.includes("reasoning");
  const reasoningActive = reasoningEffort !== "off";

  return (
    <div className="composer-wrap">
      <div className="composer">
        {pendingAttachments.length > 0 && (
          <div className="attachments-row">
            {pendingAttachments.map((att) => (
              <div key={att.id} className={`attachment-pill${att.uploading ? " uploading" : ""}`}>
                <span aria-hidden>{isImage(att.mimeType) ? "⬜" : "📄"}</span>
                <span className="pill-name">{att.filename}</span>
                {!att.uploading && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => onRemoveAttachment(att.id)}
                    aria-label={`remove ${att.filename}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="input-row">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            rows={1}
            autoFocus
          />
        </div>
        <div className="composer-tools">
          <ModelPicker value={modelId} onChange={onModelChange} />

          <MicButton
            onTranscript={(t) => onInputChange((input ? input + " " : "") + t)}
            disabled={status === "streaming" || status === "submitted"}
          />

          {supportsReasoning && (
            <div className="reasoning-wrap" ref={reasoningWrapRef}>
              <button
                type="button"
                className={`reasoning-btn${reasoningActive ? " active" : ""}`}
                onClick={() => setReasoningOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={reasoningOpen}
                title={`thinking: ${SHORT_LABEL[reasoningEffort]}`}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                  <path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z" />
                </svg>
                <span className="reasoning-btn-label">
                  think: <b>{SHORT_LABEL[reasoningEffort]}</b>
                </span>
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {reasoningOpen && (
                <div className="reasoning-popover glass-strong" role="menu" aria-label="thinking effort">
                  <div className="reasoning-popover-head">thinking effort</div>
                  {REASONING_LEVELS.map((opt) => {
                    const isActive = opt.value === reasoningEffort;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        className={`reasoning-option${isActive ? " active" : ""}`}
                        onClick={() => {
                          onReasoningEffortChange(opt.value);
                          setReasoningOpen(false);
                        }}
                      >
                        <span className="reasoning-option-dot" aria-hidden />
                        <span className="reasoning-option-label">{opt.label}</span>
                        <span className="reasoning-option-hint">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {onSwarmToggle && (
            <button
              type="button"
              className={`tool-pill${swarmMode ? " active" : ""}`}
              onClick={() => onSwarmToggle(!swarmMode)}
              aria-label={swarmMode ? "disable swarm mode" : "enable swarm mode"}
              title={swarmMode ? "swarm mode on — click to disable" : "dispatch to agent swarm"}
              style={swarmMode ? { color: "var(--green-400)", borderColor: "var(--green-400)" } : undefined}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" />
                <circle cx="19" cy="19" r="2" />
                <path d="M12 7v4M12 11l-5 6M12 11l5 6" />
              </svg>
              {swarmMode ? "swarm: on" : "swarm"}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && onFileSelect(e.target.files)}
            style={{ display: "none" }}
            accept="image/*,text/*,application/pdf,.md,.txt,.js,.ts,.py,.json,.csv"
          />
          <button
            type="button"
            className="tool-pill"
            onClick={() => fileInputRef.current?.click()}
            aria-label="attach file"
            title="attach file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            attach
          </button>

          {busy ? (
            <button type="button" className="send-btn stop" onClick={onStop} aria-label="stop">
              <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                <rect x="3" y="3" width="6" height="6" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="send-btn"
              onClick={onSubmit}
              disabled={!canSend}
              aria-label="send"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 12l18-9-9 18-2-7-7-2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
