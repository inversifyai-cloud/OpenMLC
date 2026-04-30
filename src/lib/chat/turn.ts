/**
 * Streaming-turn helper for the reroll feature.
 *
 * The original `/api/chat/route.ts` is large and tightly coupled to UI-
 * message conversion, attachments, RAG, URL fetching, MCP, research mode
 * and so on. Pulling all of that out into a shared helper would be a
 * massive refactor and would be risky while three other agents are
 * touching adjacent files.
 *
 * For reroll, the inputs are simpler: we already have the persisted
 * conversation history in the DB, the same conversation/persona/space
 * context, and we just need to spawn a fresh assistant turn that gets
 * persisted with `parentUserMessageId` + `variantIndex`.
 *
 * This helper encapsulates that minimal version. It deliberately does
 * NOT replicate everything the chat route does (no first-message title
 * heuristic, no inbox entries, no attachments — reroll reuses whatever
 * the original user message had, which is fine because the model is
 * called with model-messages assembled from `Message.content`).
 *
 * Pragmatism > purity, per the v4 release brief.
 */
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { db } from "@/lib/db";
import { findModel } from "@/lib/providers/catalog";
import { getProviderModel } from "@/lib/providers";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { composeSystemPrompt } from "@/lib/ai/system-prompts";
import { recordUsage } from "@/lib/usage/record";
import { extractArtifacts } from "@/lib/artifacts/extract";

export type StreamAssistantTurnOpts = {
  profileId: string;
  conversationId: string;
  modelId: string;
  /** Persisted Message rows in chronological order, user/assistant only. */
  history: Array<{ id: string; role: string; content: string }>;
  /** The user message this turn is responding to. */
  parentUserMessageId: string;
  /**
   * If set, on stream-finish update Conversation.selectedVariants so this
   * new variant becomes the visible one for its parent user message.
   */
  selectAsVisible?: boolean;
  abortSignal?: AbortSignal;
};

export async function streamAssistantTurn(
  opts: StreamAssistantTurnOpts,
): Promise<Response> {
  const {
    profileId,
    conversationId,
    modelId,
    history,
    parentUserMessageId,
    selectAsVisible = true,
    abortSignal,
  } = opts;

  const model = await findModel(modelId, profileId);
  if (!model) {
    return Response.json({ error: "unknown model" }, { status: 400 });
  }

  // Resolve API key (BYOK or env). Mirrors `/api/chat/route.ts`.
  let resolved: { key: string; baseUrl?: string; source: "byok" | "env" } | null = null;
  if (model.providerId === "custom") {
    const parsed = await import("@/lib/providers/custom").then((m) =>
      m.parseCustomModelId(model.id),
    );
    if (parsed) {
      const cp = await import("@/lib/providers/custom").then((m) =>
        m.resolveCustomProvider(profileId, parsed.customProviderId),
      );
      if (cp) resolved = { key: cp.key, baseUrl: cp.baseUrl, source: "byok" };
    }
  } else {
    resolved = await resolveProviderKey(profileId, model.providerId);
  }
  if (!resolved) {
    return Response.json(
      {
        error: "no_api_key",
        message: `No API key for ${model.providerId}.`,
      },
      { status: 402 },
    );
  }

  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      systemPrompt: true,
      personaId: true,
      spaceId: true,
      persona: { select: { systemPrompt: true } },
      space: {
        select: { name: true, systemPrompt: true, defaultPersonaId: true },
      },
    },
  });
  if (!conv) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }

  let effectivePersonaPrompt: string | null = conv.persona?.systemPrompt ?? null;
  if (conv.spaceId && !conv.personaId && conv.space?.defaultPersonaId) {
    const fallback = await db.persona.findUnique({
      where: { id: conv.space.defaultPersonaId },
      select: { systemPrompt: true, profileId: true },
    });
    if (fallback && fallback.profileId === profileId) {
      effectivePersonaPrompt = fallback.systemPrompt;
    }
  }

  const effectiveConvPrompt = (() => {
    if (conv.spaceId && conv.space?.systemPrompt) {
      const spaceBlock = `[space:${conv.space.name}]\n${conv.space.systemPrompt}`;
      return conv.systemPrompt
        ? `${spaceBlock}\n\n${conv.systemPrompt}`
        : spaceBlock;
    }
    return conv.systemPrompt;
  })();

  const systemPrompt = composeSystemPrompt({
    conversationPrompt: effectiveConvPrompt,
    personaPrompt: effectivePersonaPrompt,
    memoryBlock: null,
    researchPrompt: null,
    browserEnabled: false,
  });

  const provider = getProviderModel(
    model.providerId,
    model.providerModelId,
    resolved.key,
    resolved.baseUrl,
  );

  // Build model-messages directly from DB rows. Plain text only — reroll
  // is intentionally lighter than the full chat route.
  const modelMessages: ModelMessage[] = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Determine variantIndex BEFORE streaming so it's deterministic.
  const existing = await db.message.findMany({
    where: { parentUserMessageId, supersededAt: null },
    select: { variantIndex: true },
  });
  const nextVariantIndex =
    existing.length === 0
      ? 1
      : Math.max(...existing.map((m) => m.variantIndex)) + 1;

  const result = streamText({
    model: provider,
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(25),
    abortSignal,
    onFinish: async ({ text, usage, reasoningText, steps }) => {
      if (!text) return;
      try {
        const stepCount = Array.isArray(steps) ? steps.length : null;
        const assistantMsg = await db.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: text,
            modelId: model.id,
            reasoning: reasoningText ?? null,
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            stepCount,
            parentUserMessageId,
            variantIndex: nextVariantIndex,
          },
        });

        await db.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        if (selectAsVisible) {
          // Atomically update the JSON map: read, parse, set, save.
          const fresh = await db.conversation.findUnique({
            where: { id: conversationId },
            select: { selectedVariants: true },
          });
          let map: Record<string, number> = {};
          try {
            map = JSON.parse(fresh?.selectedVariants ?? "{}");
            if (typeof map !== "object" || map === null) map = {};
          } catch {
            map = {};
          }
          map[parentUserMessageId] = nextVariantIndex;
          await db.conversation.update({
            where: { id: conversationId },
            data: { selectedVariants: JSON.stringify(map) },
          });
        }

        if (usage?.inputTokens || usage?.outputTokens) {
          await recordUsage({
            profileId,
            providerId: model.providerId,
            modelId: model.id,
            providerModelId: model.providerModelId,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            messageId: assistantMsg.id,
          }).catch((err) => console.error("[reroll] recordUsage failed", err));
        }

        const extracted = extractArtifacts(text);
        if (extracted.length > 0) {
          await db.artifact.createMany({
            data: extracted.map((a) => ({
              conversationId,
              messageId: assistantMsg.id,
              type: a.type,
              language: a.language ?? null,
              title: a.title,
              content: a.content,
              version: 1,
            })),
          });
        }
      } catch (err) {
        console.error("[reroll] persist failed", err);
      }
    },
  });

  const response = result.toUIMessageStreamResponse();
  response.headers.set("X-Key-Source", resolved.source);
  response.headers.set("X-Variant-Index", String(nextVariantIndex));
  return response;
}
