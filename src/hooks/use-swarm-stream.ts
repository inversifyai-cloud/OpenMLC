"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SwarmReasoningEffort = "low" | "medium" | "high";

export type SwarmAgentSpec = {
  role: string;
  task: string;
  suggestedCapability: "research" | "code" | "reasoning" | "fast" | "general";
};

export type SwarmPlan = {
  agents: SwarmAgentSpec[];
  rationale: string;
};

export type SwarmEvent =
  | { type: "plan"; plan: SwarmPlan }
  | {
      type: "agents_resolved";
      agents: Array<{ id: string; role: string; modelId: string; providerId: string; task: string }>;
    }
  | { type: "agent_start"; agentId: string }
  | { type: "agent_token"; agentId: string; delta: string }
  | { type: "agent_reasoning"; agentId: string; delta: string }
  | {
      type: "agent_complete";
      agentId: string;
      output: string;
      inputTokens?: number;
      outputTokens?: number;
    }
  | { type: "agent_error"; agentId: string; error: string }
  | { type: "synthesis_start" }
  | { type: "synthesis_token"; delta: string }
  | { type: "complete"; finalOutput: string }
  | { type: "error"; error: string };

export type AgentRowStatus = "queued" | "running" | "completed" | "failed";

export type AgentRow = {
  id: string;
  role: string;
  modelId: string;
  providerId: string;
  task: string;
  status: AgentRowStatus;
  output: string;
  reasoning: string;
  inputTokens?: number;
  outputTokens?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type SwarmStatus =
  | "idle"
  | "planning"
  | "running"
  | "synthesizing"
  | "complete"
  | "error";

export type SwarmStartInput = {
  prompt: string;
  conversationId?: string;
  override?: {
    minAgents?: number;
    maxAgents?: number;
    reasoningEffort?: SwarmReasoningEffort;
    enabledProviders?: string[];
    supervisorModel?: string;
  };
};

function parseSseChunks(buffer: string): { events: SwarmEvent[]; remainder: string } {

  const events: SwarmEvent[] = [];
  let remainder = buffer;
  let idx = remainder.indexOf("\n\n");
  while (idx !== -1) {
    const frame = remainder.slice(0, idx);
    remainder = remainder.slice(idx + 2);
    const dataLines = frame
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""));
    if (dataLines.length > 0) {
      const payload = dataLines.join("\n");
      try {
        events.push(JSON.parse(payload) as SwarmEvent);
      } catch {

      }
    }
    idx = remainder.indexOf("\n\n");
  }
  return { events, remainder };
}

function applyEventToAgents(prev: AgentRow[], evt: SwarmEvent): AgentRow[] {
  switch (evt.type) {
    case "agents_resolved": {
      const incoming = evt.agents.map<AgentRow>((a) => ({
        id: a.id,
        role: a.role,
        modelId: a.modelId,
        providerId: a.providerId,
        task: a.task,
        status: "queued",
        output: "",
        reasoning: "",
      }));

      const byId = new Map(prev.map((a) => [a.id, a] as const));
      return incoming.map((row) => {
        const existing = byId.get(row.id);
        return existing ? { ...row, ...existing } : row;
      });
    }
    case "agent_start":
      return prev.map((a) =>
        a.id === evt.agentId
          ? { ...a, status: "running", startedAt: a.startedAt ?? new Date().toISOString() }
          : a
      );
    case "agent_token":
      return prev.map((a) =>
        a.id === evt.agentId ? { ...a, output: a.output + evt.delta } : a
      );
    case "agent_reasoning":
      return prev.map((a) =>
        a.id === evt.agentId ? { ...a, reasoning: a.reasoning + evt.delta } : a
      );
    case "agent_complete":
      return prev.map((a) =>
        a.id === evt.agentId
          ? {
              ...a,
              status: "completed",
              output: evt.output || a.output,
              inputTokens: evt.inputTokens,
              outputTokens: evt.outputTokens,
              completedAt: new Date().toISOString(),
            }
          : a
      );
    case "agent_error":
      return prev.map((a) =>
        a.id === evt.agentId
          ? { ...a, status: "failed", error: evt.error, completedAt: new Date().toISOString() }
          : a
      );
    default:
      return prev;
  }
}

export function useSwarmStream() {
  const [runId, setRunId] = useState<string | null>(null);
  const [plan, setPlan] = useState<SwarmPlan | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [synthesis, setSynthesis] = useState("");
  const [status, setStatus] = useState<SwarmStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunId(null);
    setPlan(null);
    setAgents([]);
    setSynthesis("");
    setStatus("idle");
    setError(null);
  }, []);

  const handleEvent = useCallback((evt: SwarmEvent) => {
    switch (evt.type) {
      case "plan":
        setPlan(evt.plan);
        setStatus("planning");
        break;
      case "agents_resolved":
        setAgents((prev) => applyEventToAgents(prev, evt));
        setStatus("running");
        break;
      case "agent_start":
      case "agent_token":
      case "agent_reasoning":
      case "agent_complete":
      case "agent_error":
        setAgents((prev) => applyEventToAgents(prev, evt));
        break;
      case "synthesis_start":
        setStatus("synthesizing");
        break;
      case "synthesis_token":
        setSynthesis((s) => s + evt.delta);
        break;
      case "complete":
        setSynthesis((s) => (s.length >= evt.finalOutput.length ? s : evt.finalOutput));
        setStatus("complete");
        break;
      case "error":
        setError(evt.error);
        setStatus("error");
        break;
    }
  }, []);

  const start = useCallback(
    async (input: SwarmStartInput) => {
      reset();
      setStatus("planning");
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/swarm", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify(input),
          signal: ac.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(body || `swarm request failed (${res.status})`);
        }
        const headerRunId = res.headers.get("X-Swarm-Run-Id");
        if (headerRunId) setRunId(headerRunId);
        if (!res.body) throw new Error("no response stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseChunks(buffer);
          buffer = parsed.remainder;
          for (const evt of parsed.events) handleEvent(evt);
        }

        if (buffer.trim().length > 0) {
          const final = parseSseChunks(buffer + "\n\n");
          for (const evt of final.events) handleEvent(evt);
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "swarm stream failed";
        setError(msg);
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [handleEvent, reset]
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { runId, plan, agents, synthesis, status, error, start, reset };
}

type SnapshotResponse = {
  run: {
    id: string;
    prompt: string;
    status: "planning" | "running" | "synthesizing" | "completed" | "failed";
    plan: { rationale?: string; agents?: unknown[] } | null;
    finalOutput: string | null;
    error: string | null;
    startedAt: string;
    completedAt: string | null;
  };
  agents: Array<{
    id: string;
    role: string;
    modelId: string;
    providerId: string;
    task: string;
    status: string;
    output: string | null;
    reasoning: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
};

export type UseSwarmRunResult = {
  loading: boolean;
  notFound: boolean;
  prompt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  plan: SwarmPlan | null;
  agents: AgentRow[];
  synthesis: string;
  status: SwarmStatus;
  error: string | null;
};

function parsePlan(raw: string | null): SwarmPlan | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SwarmPlan>;
    if (Array.isArray(v.agents)) {
      return {
        agents: v.agents as SwarmAgentSpec[],
        rationale: v.rationale ?? "",
      };
    }
  } catch {

    return { agents: [], rationale: raw };
  }
  return null;
}

function mapStatus(s: SnapshotResponse["run"]["status"]): SwarmStatus {
  switch (s) {
    case "planning":
      return "planning";
    case "running":
      return "running";
    case "synthesizing":
      return "synthesizing";
    case "completed":
      return "complete";
    case "failed":
      return "error";
    default:
      return "idle";
  }
}

function rowStatus(s: string): AgentRowStatus {
  if (s === "running") return "running";
  if (s === "completed") return "completed";
  if (s === "failed") return "failed";
  return "queued";
}

export function useSwarmRun(runId: string | null | undefined): UseSwarmRunResult {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [plan, setPlan] = useState<SwarmPlan | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [synthesis, setSynthesis] = useState("");
  const [status, setStatus] = useState<SwarmStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const handleEvent = useCallback((evt: SwarmEvent) => {
    switch (evt.type) {
      case "plan":
        setPlan(evt.plan);
        setStatus((s) => (s === "idle" ? "planning" : s));
        break;
      case "agents_resolved":
        setAgents((prev) => applyEventToAgents(prev, evt));
        setStatus("running");
        break;
      case "agent_start":
      case "agent_token":
      case "agent_reasoning":
      case "agent_complete":
      case "agent_error":
        setAgents((prev) => applyEventToAgents(prev, evt));
        break;
      case "synthesis_start":
        setStatus("synthesizing");
        break;
      case "synthesis_token":
        setSynthesis((s) => s + evt.delta);
        break;
      case "complete":
        setSynthesis((s) => (s.length >= evt.finalOutput.length ? s : evt.finalOutput));
        setStatus("complete");
        break;
      case "error":
        setError(evt.error);
        setStatus("error");
        break;
    }
  }, []);

  useEffect(() => {
    if (!runId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    fetch(`/api/swarm/${runId}`)
      .then(async (r) => {
        if (r.status === 404) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return null;
        }
        if (!r.ok) throw new Error(`failed to load run (${r.status})`);
        return (await r.json()) as SnapshotResponse;
      })
      .then((snap) => {
        if (cancelled || !snap) return;
        setPrompt(snap.run.prompt);
        setStartedAt(snap.run.startedAt);
        setCompletedAt(snap.run.completedAt);
        const p = snap.run.plan;
        setPlan(
          p && Array.isArray(p.agents)
            ? { rationale: p.rationale ?? "", agents: p.agents as SwarmAgentSpec[] }
            : null
        );
        setSynthesis(snap.run.finalOutput ?? "");
        setError(snap.run.error);
        setStatus(mapStatus(snap.run.status));
        setAgents(
          snap.agents.map<AgentRow>((a) => ({
            id: a.id,
            role: a.role,
            modelId: a.modelId,
            providerId: a.providerId,
            task: a.task,
            status: rowStatus(a.status),
            output: a.output ?? "",
            reasoning: a.reasoning ?? "",
            inputTokens: a.inputTokens ?? undefined,
            outputTokens: a.outputTokens ?? undefined,
            startedAt: a.startedAt ?? undefined,
            completedAt: a.completedAt ?? undefined,
          }))
        );
        setLoading(false);

        const inFlight =
          snap.run.status === "planning" ||
          snap.run.status === "running" ||
          snap.run.status === "synthesizing";
        if (inFlight && typeof window !== "undefined" && "EventSource" in window) {
          const es = new EventSource(`/api/swarm/${runId}?stream=1`);
          esRef.current = es;
          es.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data) as SwarmEvent;
              handleEvent(data);
            } catch {

            }
          };
          es.onerror = () => {
            es.close();
            esRef.current = null;
          };
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "load failed");
        setStatus("error");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [runId, handleEvent]);

  return {
    loading,
    notFound,
    prompt,
    startedAt,
    completedAt,
    plan,
    agents,
    synthesis,
    status,
    error,
  };
}
