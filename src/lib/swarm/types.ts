export type ReasoningEffort = "low" | "medium" | "high";

export type AgentSpec = {
  role: string;            // e.g. "researcher", "critic", "code-writer"
  task: string;            // natural-language assignment from supervisor
  suggestedCapability: "research" | "code" | "reasoning" | "fast" | "general";
};

export type ResolvedAgent = AgentSpec & {
  modelId: string;
  providerId: string;
};

export type SwarmEvent =
  | { type: "plan"; plan: { agents: AgentSpec[]; rationale: string } }
  | { type: "agents_resolved"; agents: Array<{ id: string; role: string; modelId: string; providerId: string; task: string }> }
  | { type: "agent_start"; agentId: string }
  | { type: "agent_token"; agentId: string; delta: string }
  | { type: "agent_reasoning"; agentId: string; delta: string }
  | { type: "agent_complete"; agentId: string; output: string; inputTokens?: number; outputTokens?: number }
  | { type: "agent_error"; agentId: string; error: string }
  | { type: "synthesis_start" }
  | { type: "synthesis_token"; delta: string }
  | { type: "complete"; finalOutput: string }
  | { type: "error"; error: string };

export type SwarmRunSummary = {
  id: string;
  prompt: string;
  status: "planning" | "running" | "synthesizing" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
};
