"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HudLabel } from "@/components/chrome/HudLabel";
import { LiveDot } from "@/components/chrome/LiveDot";
import { SwarmRunView } from "@/components/swarm/SwarmRunView";
import { useSwarmStream } from "@/hooks/use-swarm-stream";

type RunSummary = {
  id: string;
  prompt: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  _count: { agents: number };
};

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = 60_000,
    hr = 60 * min,
    day = 24 * hr;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STATUS_LIVE: Record<string, "ok" | "active" | "error" | "idle"> = {
  planning: "active",
  running: "active",
  synthesizing: "active",
  completed: "ok",
  failed: "error",
};

export function SwarmHomeClient() {
  const swarm = useSwarmStream();
  const [recent, setRecent] = useState<RunSummary[]>([]);
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState(() => searchParams.get("prompt") ?? "");
  const [loadingRecent, setLoadingRecent] = useState(true);

  async function loadRecent() {
    try {
      const res = await fetch("/api/swarm");
      if (!res.ok) return;
      const data = (await res.json()) as { runs: RunSummary[] };
      setRecent(data.runs ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingRecent(false);
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  // Refresh recent runs when an in-flight run completes.
  useEffect(() => {
    if (swarm.status === "complete" || swarm.status === "error") {
      loadRecent();
    }
  }, [swarm.status]);

  const canSubmit = useMemo(
    () => prompt.trim().length > 0 && swarm.status !== "planning" && swarm.status !== "running" && swarm.status !== "synthesizing",
    [prompt, swarm.status]
  );

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    await swarm.start({ prompt: prompt.trim() });
  }

  function onPromptKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  const showRun =
    swarm.status !== "idle" || swarm.agents.length > 0 || !!swarm.plan || !!swarm.runId;

  return (
    <div className="swarm-shell">
      <aside className="swarm-runs">
        <div className="swarm-runs-head">
          <HudLabel>recent runs</HudLabel>
          <span className="t-hud">{recent.length}</span>
        </div>
        <div className="swarm-runs-body">
          {loadingRecent && <p className="swarm-runs-empty">loading…</p>}
          {!loadingRecent && recent.length === 0 && (
            <p className="swarm-runs-empty">no runs yet</p>
          )}
          {recent.map((r) => (
            <Link key={r.id} href={`/swarm/${r.id}`} className="swarm-run-row">
              <span className="swarm-run-row-head">
                <LiveDot status={STATUS_LIVE[r.status] ?? "idle"} pulse={r.status !== "completed" && r.status !== "failed"} size={6} />
                <span className="swarm-run-row-status">{r.status}</span>
                <span className="swarm-run-row-time" suppressHydrationWarning>
                  {relTime(r.startedAt)}
                </span>
              </span>
              <span className="swarm-run-row-prompt">{r.prompt}</span>
              <span className="swarm-run-row-meta">
                {r._count.agents} {r._count.agents === 1 ? "agent" : "agents"}
              </span>
            </Link>
          ))}
        </div>
      </aside>

      <main className="swarm-main">
        <form className="swarm-composer" onSubmit={submit}>
          <HudLabel>new run</HudLabel>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onPromptKey}
            placeholder="what should the swarm investigate? describe the problem, the goal, and any constraints."
            rows={5}
          />
          <div className="swarm-composer-foot">
            <span className="t-hud">⌘ + enter to dispatch</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {showRun && (
                <button
                  type="button"
                  className="tool-pill"
                  onClick={() => {
                    swarm.reset();
                    setPrompt("");
                  }}
                >
                  reset
                </button>
              )}
              <button type="submit" className="new-chat" disabled={!canSubmit}>
                {swarm.status === "planning"
                  ? "planning…"
                  : swarm.status === "running"
                    ? "agents working…"
                    : swarm.status === "synthesizing"
                      ? "synthesizing…"
                      : "dispatch swarm"}
              </button>
            </div>
          </div>
        </form>

        {showRun && (
          <SwarmRunView
            prompt={prompt.trim() || null}
            status={swarm.status}
            plan={swarm.plan}
            agents={swarm.agents}
            synthesis={swarm.synthesis}
            error={swarm.error}
          />
        )}
      </main>
    </div>
  );
}
