import { streamText } from "ai";
import { db } from "@/lib/db";
import { getProviderModel } from "@/lib/providers";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { findModel } from "@/lib/providers/catalog";
import type { StreamBus } from "./stream-bus";
import type { ResolvedAgent } from "./types";

export async function runAgent(opts: {
  profileId: string;
  swarmRunId: string;
  agentDbId: string;
  spec: ResolvedAgent;
  systemPrompt: string;
  userPrompt: string;
  bus: StreamBus;
}): Promise<{ output: string; inputTokens?: number; outputTokens?: number }> {
  const { agentDbId, bus, spec, profileId } = opts;

  await db.swarmAgent.update({
    where: { id: agentDbId },
    data: { status: "running", startedAt: new Date() },
  });
  bus.emit({ type: "agent_start", agentId: agentDbId });

  const model = await findModel(spec.modelId, profileId);
  if (!model) {
    bus.emit({ type: "agent_error", agentId: agentDbId, error: `Unknown model: ${spec.modelId}` });
    await db.swarmAgent.update({
      where: { id: agentDbId },
      data: { status: "failed", completedAt: new Date() },
    });
    throw new Error(`Unknown model: ${spec.modelId}`);
  }

  const resolved = await resolveProviderKey(profileId, model.providerId);
  if (!resolved) {
    const err = `No API key for ${model.providerId}`;
    bus.emit({ type: "agent_error", agentId: agentDbId, error: err });
    await db.swarmAgent.update({
      where: { id: agentDbId },
      data: { status: "failed", completedAt: new Date() },
    });
    throw new Error(err);
  }

  const langModel = getProviderModel(model.providerId, model.providerModelId, resolved.key, resolved.baseUrl);

  try {
    const result = streamText({
      model: langModel,
      system: opts.systemPrompt,
      prompt: opts.userPrompt,
    });

    let output = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        const delta =
          (part as unknown as { text?: string; textDelta?: string }).text ??
          (part as unknown as { text?: string; textDelta?: string }).textDelta ??
          "";
        output += delta;
        bus.emit({ type: "agent_token", agentId: agentDbId, delta });
      } else if (part.type === "reasoning-delta") {
        const delta =
          (part as unknown as { text?: string; textDelta?: string }).text ??
          (part as unknown as { text?: string; textDelta?: string }).textDelta ??
          "";
        bus.emit({ type: "agent_reasoning", agentId: agentDbId, delta });
      }
    }

    const usage = await result.usage;
    const inputTokens = usage?.inputTokens ?? undefined;
    const outputTokens = usage?.outputTokens ?? undefined;

    await db.swarmAgent.update({
      where: { id: agentDbId },
      data: {
        status: "completed",
        output,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
        completedAt: new Date(),
      },
    });
    bus.emit({ type: "agent_complete", agentId: agentDbId, output, inputTokens, outputTokens });
    return { output, inputTokens, outputTokens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "agent failed";
    bus.emit({ type: "agent_error", agentId: agentDbId, error: msg });
    await db.swarmAgent.update({
      where: { id: agentDbId },
      data: { status: "failed", completedAt: new Date() },
    });
    throw err;
  }
}
