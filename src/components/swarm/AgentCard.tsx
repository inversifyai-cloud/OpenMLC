"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HudLabel } from "@/components/chrome/HudLabel";
import { LiveDot } from "@/components/chrome/LiveDot";
import type { AgentRow } from "@/hooks/use-swarm-stream";

const PROVIDER_DOT: Record<string, string> = {
  openai: "var(--mint-400)",
  anthropic: "#cd7f32",
  google: "var(--cyan-500)",
  xai: "var(--fg-2)",
  fireworks: "#ff6b35",
  openrouter: "#a78bfa",
  ollama: "var(--fg-3)",
};

const STATUS_LABEL: Record<AgentRow["status"], string> = {
  queued: "queued",
  running: "running",
  completed: "complete",
  failed: "failed",
};

const STATUS_COLOR: Record<AgentRow["status"], string> = {
  queued: "var(--fg-4)",
  running: "var(--fg-accent)",
  completed: "var(--fg-mint)",
  failed: "var(--signal-err)",
};

function fmtDuration(startedAt?: string, completedAt?: string): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s - m * 60);
  return `${m}m ${rs}s`;
}

function fmtTok(n?: number): string | null {
  if (typeof n !== "number") return null;
  return `${n.toLocaleString()} tok`;
}

function shortModel(modelId: string): string {
  return modelId.replace(/^or:/, "").replace(/:free$/, "");
}

type Props = {
  agent: AgentRow;
};

export function AgentCard({ agent }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const [, setTick] = useState(0);

  // Live timer ticker for running agents.
  useEffect(() => {
    if (agent.status !== "running") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [agent.status]);

  // Auto-scroll output as it streams.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (agent.status === "running" || agent.status === "completed") {
      el.scrollTop = el.scrollHeight;
    }
  }, [agent.output, agent.status]);

  const liveStatus =
    agent.status === "running"
      ? ("active" as const)
      : agent.status === "failed"
        ? ("error" as const)
        : agent.status === "completed"
          ? ("ok" as const)
          : ("idle" as const);

  const dur = fmtDuration(agent.startedAt, agent.completedAt);
  const tokIn = fmtTok(agent.inputTokens);
  const tokOut = fmtTok(agent.outputTokens);

  return (
    <div className="agent-card" data-status={agent.status}>
      <div className="agent-card-head">
        <span
          aria-hidden
          className="agent-card-provider-dot"
          style={{ background: PROVIDER_DOT[agent.providerId] ?? "var(--fg-3)" }}
        />
        <span className="agent-card-role">{agent.role}</span>
        <span className="agent-card-model" title={agent.modelId}>
          {shortModel(agent.modelId)}
        </span>
        <span className="agent-card-status" style={{ color: STATUS_COLOR[agent.status] }}>
          <LiveDot status={liveStatus} pulse size={6} />
          <span>{STATUS_LABEL[agent.status]}</span>
        </span>
      </div>

      <p className="agent-card-task">{agent.task}</p>

      <div className="agent-card-body" ref={bodyRef}>
        {agent.error ? (
          <div className="agent-card-error">{agent.error}</div>
        ) : agent.output.length === 0 ? (
          <span className="agent-card-empty">
            {agent.status === "queued" ? "waiting…" : agent.status === "running" ? "streaming…" : "no output"}
          </span>
        ) : (
          <div className="agent-card-output-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{agent.output}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="agent-card-foot">
        <HudLabel>
          {dur ? <span>{dur}</span> : <span>—</span>}
          {tokIn && (
            <>
              <span className="agent-card-foot-sep">·</span>
              <span>in {tokIn}</span>
            </>
          )}
          {tokOut && (
            <>
              <span className="agent-card-foot-sep">·</span>
              <span>out {tokOut}</span>
            </>
          )}
        </HudLabel>
      </div>

      {agent.reasoning.length > 0 && (
        <details
          className="agent-card-reasoning"
          open={reasoningOpen}
          onToggle={(e) => setReasoningOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>
            <span className="t-hud">reasoning</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              width="12"
              height="12"
              className="agent-card-reasoning-chev"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <pre className="agent-card-reasoning-body">{agent.reasoning}</pre>
        </details>
      )}
    </div>
  );
}
