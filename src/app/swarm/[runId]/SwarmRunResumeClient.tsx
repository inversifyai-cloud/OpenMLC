"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SwarmRunView } from "@/components/swarm/SwarmRunView";
import { useSwarmRun } from "@/hooks/use-swarm-stream";

export function SwarmRunResumeClient({ runId }: { runId: string }) {
  const run = useSwarmRun(runId);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm("delete this run? this is permanent.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/swarm/${runId}`, { method: "DELETE" });
      if (res.ok) router.push("/swarm");
    } finally {
      setDeleting(false);
    }
  }

  if (run.loading) {
    return (
      <div style={{ padding: 40, color: "var(--fg-3)", fontSize: 13 }}>
        loading run…
      </div>
    );
  }
  if (run.notFound) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: "var(--fg-3)", fontSize: 14 }}>run not found.</p>
        <Link href="/swarm" className="tool-pill" style={{ marginTop: 12, display: "inline-block" }}>
          back to swarm
        </Link>
      </div>
    );
  }

  const canDelete = run.status === "complete" || run.status === "error";

  return (
    <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/swarm" className="tool-pill">
          ← back
        </Link>
        <span className="t-hud" style={{ marginLeft: "auto" }}>
          run · {runId.slice(0, 8)}
        </span>
        {canDelete && (
          <button
            type="button"
            className="tool-pill"
            style={{ color: "var(--signal-err)" }}
            onClick={remove}
            disabled={deleting}
          >
            {deleting ? "deleting…" : "delete run"}
          </button>
        )}
      </div>

      <SwarmRunView
        prompt={run.prompt}
        status={run.status}
        plan={run.plan}
        agents={run.agents}
        synthesis={run.synthesis}
        error={run.error}
        startedAt={run.startedAt}
        completedAt={run.completedAt}
      />
    </div>
  );
}
