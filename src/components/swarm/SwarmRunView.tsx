"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HudLabel } from "@/components/chrome/HudLabel";
import { LiveDot } from "@/components/chrome/LiveDot";
import { AgentCard } from "./AgentCard";
import type {
  AgentRow,
  SwarmPlan,
  SwarmStatus,
} from "@/hooks/use-swarm-stream";

type Props = {
  prompt: string | null;
  status: SwarmStatus;
  plan: SwarmPlan | null;
  agents: AgentRow[];
  synthesis: string;
  error: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  embedded?: boolean;
};

const STATUS_PILL_LABEL: Record<SwarmStatus, string> = {
  idle: "idle",
  planning: "planning",
  running: "running",
  synthesizing: "synthesizing",
  complete: "complete",
  error: "failed",
};

const STATUS_LIVE: Record<SwarmStatus, "ok" | "active" | "error" | "idle"> = {
  idle: "idle",
  planning: "active",
  running: "active",
  synthesizing: "active",
  complete: "ok",
  error: "error",
};

function fmtElapsed(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return "0.0s";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = Math.max(0, e - s);
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const rs = Math.round(sec - m * 60);
  return `${m}m ${rs}s`;
}

export function SwarmRunView({
  prompt,
  status,
  plan,
  agents,
  synthesis,
  error,
  startedAt,
  completedAt,
  embedded = false,
}: Props) {
  // Tick for live elapsed-time display.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status === "complete" || status === "error" || status === "idle") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [status]);

  const elapsed = fmtElapsed(startedAt, completedAt);
  const agentCount = agents.length;
  const completedCount = agents.filter((a) => a.status === "completed").length;

  return (
    <div className={`swarm-run${embedded ? " swarm-run-embedded" : ""}`}>
      <header className="swarm-run-head">
        <div className="swarm-status">
          <LiveDot status={STATUS_LIVE[status]} pulse size={7} />
          <span className="swarm-status-label">{STATUS_PILL_LABEL[status]}</span>
        </div>
        {!embedded && prompt && (
          <p className="swarm-run-prompt" title={prompt}>
            {prompt}
          </p>
        )}
        <div className="swarm-run-meta">
          <HudLabel>
            <span>
              {agentCount > 0 ? `${completedCount}/${agentCount} agents` : "0 agents"}
            </span>
            <span className="swarm-run-meta-sep">·</span>
            <span>{elapsed}</span>
          </HudLabel>
        </div>
      </header>

      {plan?.rationale && (
        <section className="swarm-plan">
          <HudLabel>plan rationale</HudLabel>
          <p className="swarm-plan-text">{plan.rationale}</p>
        </section>
      )}

      {error && (
        <div className="swarm-error" role="alert">
          <HudLabel>error</HudLabel>
          <p>{error}</p>
        </div>
      )}

      {agents.length > 0 && (
        <div className="agent-grid">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}

      {(status === "synthesizing" || status === "complete" || synthesis.length > 0) && (
        <section className="synthesis-panel glass-strong">
          <div className="synthesis-panel-head">
            <HudLabel>synthesis</HudLabel>
            {status === "synthesizing" && (
              <span className="synthesis-streaming">
                <LiveDot status="ok" pulse size={6} />
                <span>streaming</span>
              </span>
            )}
          </div>
          <div className="synthesis-panel-body synthesis-panel-body-md">
            {synthesis ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{synthesis}</ReactMarkdown>
            ) : (
              <span style={{ color: "var(--fg-4)", fontStyle: "italic", fontSize: 13 }}>
                preparing final answer…
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
