"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentRow, SwarmPlan, SwarmStatus } from "@/hooks/use-swarm-stream";

type Props = {
  status: SwarmStatus;
  plan: SwarmPlan | null;
  agents: AgentRow[];
  synthesis: string;
  error: string | null;
  onDismiss?: () => void;
};

const STATUS_LABEL: Record<SwarmStatus, string> = {
  idle: "idle",
  planning: "planning…",
  running: "running",
  synthesizing: "synthesizing…",
  complete: "complete",
  error: "failed",
};

const DOT_COLOR: Record<string, string> = {
  queued:    "var(--fg-4)",
  running:   "var(--green-400)",
  completed: "var(--green-400)",
  failed:    "var(--signal-err)",
  planning:  "var(--green-400)",
  synthesizing: "var(--green-400)",
  complete:  "var(--green-400)",
  error:     "var(--signal-err)",
};

function shortModel(id: string) {
  return id.replace(/^or:/, "").replace(/:free$/, "").split("/").pop() ?? id;
}

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        boxShadow: pulse ? `0 0 6px ${color}` : undefined,
        animation: pulse ? "swarm-inline-pulse 1.2s ease-in-out infinite" : undefined,
      }}
    />
  );
}

type AgentItemProps = { agent: AgentRow; isLast: boolean };

function AgentItem({ agent, isLast }: AgentItemProps) {
  const [open, setOpen] = useState(agent.status === "running");
  const dotColor = DOT_COLOR[agent.status] ?? "var(--fg-4)";
  const isRunning = agent.status === "running";
  const hasOutput = agent.output.length > 0;

  return (
    <div style={{ display: "flex", gap: 0 }}>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
        <Dot color={dotColor} pulse={isRunning} />
        {!isLast && (
          <div style={{ width: 1, flex: 1, background: "var(--stroke-2)", marginTop: 3, minHeight: 12 }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 10, paddingLeft: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: hasOutput ? "pointer" : "default" }}
          onClick={() => hasOutput && setOpen((v) => !v)}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-1)", fontWeight: 500 }}>
            {agent.role}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)" }}>
            {shortModel(agent.modelId)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: dotColor, marginLeft: "auto" }}>
            {agent.status === "queued" ? "queued" : agent.status === "running" ? "running…" : agent.status === "completed" ? "done" : "failed"}
          </span>
          {hasOutput && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)", userSelect: "none" }}>
              {open ? "▴" : "▾"}
            </span>
          )}
        </div>

        {agent.error && (
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--signal-err)", fontFamily: "var(--font-mono)" }}>
            {agent.error}
          </div>
        )}

        {open && hasOutput && (
          <div style={{
            marginTop: 6,
            padding: "8px 10px",
            background: "var(--surface-1)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-2)",
            fontSize: 12,
            color: "var(--fg-2)",
            lineHeight: 1.6,
            maxHeight: 240,
            overflowY: "auto",
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{agent.output}</ReactMarkdown>
          </div>
        )}

        {open && agent.reasoning.length > 0 && (
          <div style={{
            marginTop: 4,
            padding: "6px 10px",
            background: "rgba(var(--green-glow), 0.04)",
            border: "1px solid var(--stroke-1)",
            borderRadius: "var(--r-2)",
            fontSize: 11,
            color: "var(--fg-4)",
            fontFamily: "var(--font-mono)",
            fontStyle: "italic",
            maxHeight: 120,
            overflowY: "auto",
            lineHeight: 1.5,
          }}>
            {agent.reasoning}
          </div>
        )}
      </div>
    </div>
  );
}

export function SwarmInlineView({ status, plan, agents, synthesis, error, onDismiss }: Props) {
  const isActive = status !== "idle" && status !== "complete" && status !== "error";
  const isDone = status === "complete" || status === "error";
  const totalAgents = agents.length;
  const doneAgents = agents.filter((a) => a.status === "completed").length;

  const summaryLabel =
    totalAgents > 0
      ? `swarm · ${doneAgents}/${totalAgents} · ${STATUS_LABEL[status]}`
      : `swarm · ${STATUS_LABEL[status]}`;

  const overallDot = DOT_COLOR[status] ?? "var(--fg-4)";

  return (
    <>
      <style>{`
        @keyframes swarm-inline-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .swarm-inline-summary {
          list-style: none;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 0;
          user-select: none;
        }
        .swarm-inline-summary::-webkit-details-marker { display: none; }
        .swarm-dismiss-btn {
          margin-left: auto;
          background: transparent;
          border: 1px solid var(--stroke-1);
          border-radius: var(--r-1);
          color: var(--fg-4);
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 2px 6px;
          cursor: pointer;
          transition: color 120ms, border-color 120ms;
        }
        .swarm-dismiss-btn:hover { color: var(--fg-2); border-color: var(--stroke-2); }
      `}</style>

      <details open={isActive} style={{ marginTop: 6 }}>
        <summary className="swarm-inline-summary">
          <Dot color={overallDot} pulse={isActive} />
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            color: "var(--fg-3)",
            textTransform: "lowercase",
          }}>
            {summaryLabel}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)", marginLeft: 2 }}>
            {isActive ? "▴" : "▾"}
          </span>
          {isDone && onDismiss && (
            <button
              type="button"
              className="swarm-dismiss-btn"
              onClick={(e) => { e.preventDefault(); onDismiss(); }}
              aria-label="dismiss swarm panel"
            >
              dismiss
            </button>
          )}
        </summary>

        <div style={{ marginTop: 10, paddingLeft: 2 }}>

          {plan && (
            <div style={{ display: "flex", gap: 0, marginBottom: agents.length > 0 ? 0 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                <Dot color="var(--green-400)" />
                {(agents.length > 0 || synthesis) && (
                  <div style={{ width: 1, flex: 1, background: "var(--stroke-2)", marginTop: 3, minHeight: 12 }} />
                )}
              </div>
              <div style={{ flex: 1, paddingBottom: agents.length > 0 ? 10 : 0, paddingLeft: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>plan</span>
                {plan.rationale && (
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, fontStyle: "italic" }}>
                    {plan.rationale}
                  </p>
                )}
              </div>
            </div>
          )}

          {agents.map((agent, i) => (
            <AgentItem
              key={agent.id}
              agent={agent}
              isLast={i === agents.length - 1 && !synthesis}
            />
          ))}

          {(status === "synthesizing" || status === "complete" || synthesis.length > 0) && (
            <div style={{ display: "flex", gap: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                <Dot color={status === "synthesizing" ? "var(--green-400)" : status === "complete" ? "var(--green-400)" : "var(--fg-4)"} pulse={status === "synthesizing"} />
              </div>
              <div style={{ flex: 1, paddingLeft: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
                  {status === "synthesizing" ? "synthesis…" : "synthesis"}
                </span>
                {synthesis.length > 0 && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: "var(--fg-2)",
                    lineHeight: 1.65,
                  }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{synthesis}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div style={{ display: "flex", gap: 0 }}>
              <div style={{ width: 20, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
                <Dot color="var(--signal-err)" />
              </div>
              <div style={{ flex: 1, paddingLeft: 8, fontSize: 12, color: "var(--signal-err)", fontFamily: "var(--font-mono)" }}>
                {error}
              </div>
            </div>
          )}
        </div>
      </details>
    </>
  );
}
