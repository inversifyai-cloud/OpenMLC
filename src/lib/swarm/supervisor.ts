import { generateObject } from "ai";
import { z } from "zod";
import { getProviderModel } from "@/lib/providers";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { findModel } from "@/lib/providers/catalog";
import type { AgentSpec, ReasoningEffort } from "./types";

const planSchema = z.object({
  rationale: z.string().min(10).max(500),
  agents: z.array(
    z.object({
      role: z.string().min(2).max(40),
      task: z.string().min(10).max(800),
      suggestedCapability: z.enum(["research", "code", "reasoning", "fast", "general"]),
    })
  ),
});

export async function planSwarm(opts: {
  profileId: string;
  prompt: string;
  supervisorModelId: string;
  minAgents: number;
  maxAgents: number;
  reasoningEffort: ReasoningEffort;
}): Promise<{ rationale: string; agents: AgentSpec[] }> {
  const model = await findModel(opts.supervisorModelId, opts.profileId);
  if (!model) throw new Error(`Unknown supervisor model: ${opts.supervisorModelId}`);

  const resolved = await resolveProviderKey(opts.profileId, model.providerId);
  if (!resolved) throw new Error(`No API key for ${model.providerId}`);

  const langModel = getProviderModel(model.providerId, model.providerModelId, resolved.key, resolved.baseUrl);

  const system = `You are the supervisor of a small expert agent swarm. Your job: given a user's request, decide how many agents to dispatch (between ${opts.minAgents} and ${opts.maxAgents}, inclusive) and what each agent should do. Each agent is an independent LLM that will work in parallel. After they all finish, their outputs will be synthesized.

Pick agents to maximize coverage and minimize overlap. Common roles: researcher (gathers facts/sources), analyst (interprets), critic (challenges assumptions), code-writer (implements), explainer (synthesizes for laypeople), planner (proposes structure).

For each agent, set suggestedCapability based on the task:
- research: needs to gather/cite info → routed to long-context research models (e.g. Gemini Pro, Claude Sonnet)
- code: writes/reviews code → routed to coding-strong models
- reasoning: deep step-by-step thinking → routed to reasoning models (o-series, Claude with extended thinking)
- fast: quick lookup / formatting → routed to fast/cheap models (Haiku, Flash, mini)
- general: balanced default

Reasoning effort dial: ${opts.reasoningEffort}. high = unlock deeper reasoning models, more agents toward the max. low = lean fast/cheap, fewer agents toward the min.

Return a tight, focused plan. Don't over-decompose simple questions.`;

  const { object } = await generateObject({
    model: langModel,
    schema: planSchema,
    system,
    prompt: `User request:\n\n${opts.prompt}\n\nProduce the plan.`,
  });

  // Clamp to min/max
  const agents = object.agents.slice(0, opts.maxAgents);
  while (agents.length < opts.minAgents) {
    agents.push({
      role: "generalist",
      task: opts.prompt,
      suggestedCapability: "general",
    });
  }

  return { rationale: object.rationale, agents };
}
