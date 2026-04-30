import { streamText } from "ai";
import { db } from "@/lib/db";
import { recordInboxEntry } from "@/lib/inbox";
import { getProviderModel } from "@/lib/providers";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { findModel } from "@/lib/providers/catalog";
import { planSwarm } from "./supervisor";
import { pickAgentSpecs } from "./router";
import { runAgent } from "./agent";
import { getOrCreateBus } from "./stream-bus";
import type { ReasoningEffort } from "./types";

export async function orchestrateSwarm(opts: {
  profileId: string;
  swarmRunId: string;
  prompt: string;
  conversationId?: string | null;
  config: {
    enabledProviders: string[];
    minAgents: number;
    maxAgents: number;
    reasoningEffort: ReasoningEffort;
    supervisorModel: string;
  };
}): Promise<void> {
  const bus = getOrCreateBus(opts.swarmRunId);

  try {

    await db.swarmRun.update({ where: { id: opts.swarmRunId }, data: { status: "planning" } });
    const plan = await planSwarm({
      profileId: opts.profileId,
      prompt: opts.prompt,
      supervisorModelId: opts.config.supervisorModel,
      minAgents: opts.config.minAgents,
      maxAgents: opts.config.maxAgents,
      reasoningEffort: opts.config.reasoningEffort,
    });

    bus.emit({ type: "plan", plan });
    await db.swarmRun.update({
      where: { id: opts.swarmRunId },
      data: { plan: JSON.stringify(plan) },
    });

    const resolvedAgents = await pickAgentSpecs({
      profileId: opts.profileId,
      agents: plan.agents,
      enabledProviders: opts.config.enabledProviders,
      reasoningEffort: opts.config.reasoningEffort,
    });

    const agentRows = await Promise.all(
      resolvedAgents.map((a) =>
        db.swarmAgent.create({
          data: {
            swarmRunId: opts.swarmRunId,
            role: a.role,
            modelId: a.modelId,
            providerId: a.providerId,
            task: a.task,
            status: "queued",
          },
        })
      )
    );

    bus.emit({
      type: "agents_resolved",
      agents: agentRows.map((row) => ({
        id: row.id,
        role: row.role,
        modelId: row.modelId,
        providerId: row.providerId,
        task: row.task,
      })),
    });

    await db.swarmRun.update({ where: { id: opts.swarmRunId }, data: { status: "running" } });

    const agentSystemPrompt = `You are one expert agent in a small swarm. Your specific role: {ROLE}. Your specific task: {TASK}\n\nThe user's original request is provided below for context. Focus your output on YOUR task only — other agents are handling other facets in parallel. Be concise, factual, and structured. Don't preface or hedge.`;

    const outputs = await Promise.allSettled(
      agentRows.map((row, i) =>
        runAgent({
          profileId: opts.profileId,
          swarmRunId: opts.swarmRunId,
          agentDbId: row.id,
          spec: resolvedAgents[i],
          systemPrompt: agentSystemPrompt
            .replace("{ROLE}", resolvedAgents[i].role)
            .replace("{TASK}", resolvedAgents[i].task),
          userPrompt: opts.prompt,
          bus,
        })
      )
    );

    const successful = outputs
      .map((r, i) => (r.status === "fulfilled" ? { agent: resolvedAgents[i], ...r.value } : null))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (successful.length === 0) {
      throw new Error("all agents failed");
    }

    bus.emit({ type: "synthesis_start" });
    await db.swarmRun.update({ where: { id: opts.swarmRunId }, data: { status: "synthesizing" } });

    const supModel = await findModel(opts.config.supervisorModel, opts.profileId);
    if (!supModel) throw new Error(`Unknown synthesis model`);
    const supKey = await resolveProviderKey(opts.profileId, supModel.providerId);
    if (!supKey) throw new Error(`No key for synthesis model`);
    const supLang = getProviderModel(supModel.providerId, supModel.providerModelId, supKey.key, supKey.baseUrl);

    const synthInputs = successful
      .map(
        (s, i) =>
          `## Agent ${i + 1} (${s.agent.role}, ${s.agent.modelId})\nTask: ${s.agent.task}\n\nOutput:\n${s.output}`
      )
      .join("\n\n---\n\n");

    const synthSystem = `You are the synthesizer for a swarm of expert agents. Each agent worked on a piece of the user's request in parallel. Your job: produce a single, coherent, well-structured final answer to the user's original request, drawing from the agents' outputs. Cite agents inline as (agent N) where helpful. Don't repeat their work verbatim — distill and unify. Use clear sections/headings for complex topics; be terse for simple ones.`;

    const synthResult = streamText({
      model: supLang,
      system: synthSystem,
      prompt: `User's original request:\n\n${opts.prompt}\n\n---\n\n${synthInputs}\n\n---\n\nProduce the final synthesized answer now.`,
    });

    let finalOutput = "";
    for await (const part of synthResult.fullStream) {
      if (part.type === "text-delta") {
        const delta =
          (part as unknown as { text?: string; textDelta?: string }).text ??
          (part as unknown as { text?: string; textDelta?: string }).textDelta ??
          "";
        finalOutput += delta;
        bus.emit({ type: "synthesis_token", delta });
      }
    }

    await db.swarmRun.update({
      where: { id: opts.swarmRunId },
      data: { status: "completed", finalOutput, completedAt: new Date() },
    });
    bus.emit({ type: "complete", finalOutput });

    // inbox: swarm completion entry
    {
      const promptText = (opts.prompt ?? "").trim();
      const title = promptText
        ? (promptText.length > 100 ? promptText.slice(0, 99) + "…" : promptText)
        : "swarm run";
      const agentCount = resolvedAgents.length;
      void recordInboxEntry({
        profileId: opts.profileId,
        kind: "swarm_run",
        title,
        summary: `${agentCount} agent${agentCount === 1 ? "" : "s"} synthesized`,
        refType: "swarm_run",
        refId: opts.swarmRunId,
      });
    }

    if (opts.conversationId && finalOutput) {
      try {
        await db.message.create({
          data: {
            conversationId: opts.conversationId,
            role: "assistant",
            content: finalOutput,
            modelId: opts.config.supervisorModel,
          },
        });
        await db.conversation.update({
          where: { id: opts.conversationId },
          data: { updatedAt: new Date() },
        });
      } catch (err) {
        console.error("[swarm] failed to persist synthesis to conversation", err);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "swarm failed";
    await db.swarmRun.update({
      where: { id: opts.swarmRunId },
      data: { status: "failed", error: msg, completedAt: new Date() },
    });
    bus.emit({ type: "error", error: msg });
  }
}
