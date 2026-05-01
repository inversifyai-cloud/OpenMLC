import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { findModel } from "@/lib/providers/catalog";
import { getProviderModel } from "@/lib/providers";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { composeSystemPrompt, RESEARCH_PROMPT } from "@/lib/ai/system-prompts";
import { searchMemories, formatMemoriesForPrompt, extractMemoriesFromConversation } from "@/lib/ai/memory";
import { isImage, imageToBuffer } from "@/lib/attachments";
import { buildToolsForRequest, toolsSystemPromptHint } from "@/lib/ai/tools";
import type { ToolContext } from "@/lib/ai/tools/types";
import { buildRAGContext } from "@/lib/ai/knowledge-rag";
import { fetchUrlContent, extractUrls } from "@/lib/url-reader";
import { getSettings } from "@/lib/settings";
import { buildMcpTools } from "@/lib/mcp/client";
import { recordUsage } from "@/lib/usage/record";
import { checkBudget } from "@/lib/usage/budget";
import { extractArtifacts } from "@/lib/artifacts/extract";
// inbox: record completion of long-running async work (research, browser).
import { recordInboxEntry } from "@/lib/inbox";

const bodySchema = z.object({
  messages: z.array(z.any()),
  modelId: z.string().min(1),
  conversationId: z.string().min(1),
  attachmentIds: z.array(z.string()).optional(),
  reasoningEffort: z.enum(["off", "low", "medium", "high"]).optional(),
  toolsEnabled: z.boolean().optional(),
  webSearchEnabled: z.boolean().optional(),
  knowledgeBaseEnabled: z.boolean().optional(),
  researchMode: z.boolean().optional(),
  browserMode: z.boolean().optional(),
  computerMode: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const {
    messages,
    modelId,
    conversationId,
    attachmentIds,
    reasoningEffort = "off",
    toolsEnabled = true,
    webSearchEnabled = true,
    knowledgeBaseEnabled = true,
    researchMode = false,
    browserMode = false,
    computerMode = false,
  } = parsed.data;
  const uiMessages = messages as UIMessage[];

  const model = await findModel(modelId, profileId);
  if (!model) {
    return Response.json({ error: "unknown model" }, { status: 400 });
  }

  const budget = await checkBudget(profileId, model.providerId);
  if (budget.exceeded) {
    return Response.json(
      { error: "budget_exceeded", capUsd: budget.capUsd, currentUsd: budget.currentUsd },
      { status: 402 }
    );
  }

  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      profileId: true,
      systemPrompt: true,
      personaId: true,
      // [spaces] inherit defaults from space when conversation has no overrides
      spaceId: true,
      persona: { select: { systemPrompt: true } },
      space: {
        select: {
          id: true,
          name: true,
          systemPrompt: true,
          defaultPersonaId: true,
        },
      },
    },
  });
  if (!conv || conv.profileId !== profileId) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }

  const profileForPrefs = await db.profile.findUnique({
    where: { id: profileId },
    select: { memoryUseInContext: true },
  });

  // [spaces] If a conversation lives in a space and has no persona, fall back
  // to the space's default persona for system-prompt purposes.
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

  let resolved: { key: string; baseUrl?: string; source: "byok" | "env" } | null = null;
  if (model.providerId === "custom") {
    const parsed = await import("@/lib/providers/custom").then((m) => m.parseCustomModelId(model.id));
    if (parsed) {
      const cp = await import("@/lib/providers/custom").then((m) => m.resolveCustomProvider(profileId, parsed.customProviderId));
      if (cp) resolved = { key: cp.key, baseUrl: cp.baseUrl, source: "byok" };
    }
  } else {
    resolved = await resolveProviderKey(profileId, model.providerId);
  }
  if (!resolved) {
    return Response.json(
      {
        error: "no_api_key",
        message: `No API key for ${model.providerId}. Add one in Settings → API keys, or set the ${model.providerId.toUpperCase()}_API_KEY env var.`,
      },
      { status: 402 }
    );
  }

  const attachments = attachmentIds?.length
    ? await db.attachment.findMany({
        where: { id: { in: attachmentIds }, profileId },
      })
    : [];

  const imageAttachments = attachments.filter((a) => isImage(a.mimeType));
  const textAttachments = attachments.filter((a) => a.extractedText);

  const textContext = textAttachments
    .map((a) => `\n\n[Attached file: ${a.filename}]\n${a.extractedText ?? ""}`)
    .join("");

  const lastUi = uiMessages.at(-1);
  const userText = lastUi ? extractText(lastUi) : "";
  const storedContent = (userText + textContext).trim() || "[attachment]";

  const userMsg = await db.message.create({
    data: {
      conversationId,
      role: "user",
      content: storedContent,
      modelId: model.id,
    },
  });

  if (attachmentIds?.length) {
    await db.attachment.updateMany({
      where: { id: { in: attachmentIds }, profileId, messageId: null },
      data: { messageId: userMsg.id },
    });
  }

  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date(), modelId: model.id },
  });

  if (model.capabilities.includes("image-gen")) {
    return handleImageGen(model, resolved.key, userText || "[generate an image]", conversationId, profileId);
  }

  const provider = getProviderModel(
    model.providerId,
    model.providerModelId,
    resolved.key,
    resolved.baseUrl
  );

  let ragContext: string | null = null;
  if (knowledgeBaseEnabled && userText) {
    try {
      // [spaces] When in a space, RAG scope = space files + root files.
      ragContext = await buildRAGContext(profileId, userText, {
        maxChars: 6000,
        spaceId: conv.spaceId ?? undefined,
      });
    } catch (err) {
      console.error("[chat] RAG lookup failed", err);
    }
  }

  const urlInjections: string[] = [];
  if (userText) {
    const urls = extractUrls(userText).slice(0, 3);
    if (urls.length > 0) {
      const fetched = await Promise.all(urls.map((u) => fetchUrlContent(u).catch(() => null)));
      for (let i = 0; i < urls.length; i++) {
        const r = fetched[i];
        if (r) {
          urlInjections.push(
            `[Fetched ${urls[i]} (${r.hostname})]\nTitle: ${r.title}\n\n${r.text}`
          );
        }
      }
    }
  }

  const tavilyKey = process.env.TAVILY_API_KEY ?? undefined;
  const openaiResolved = await resolveProviderKey(profileId, "openai");
  const settings = await getSettings();
  const computerAgentUrl = settings.computerAgentUrl ?? process.env.OPENMLC_COMPUTER_URL ?? undefined;
  const computerAgentToken = settings.computerAgentToken ?? process.env.OPENMLC_COMPUTER_TOKEN ?? undefined;
  const toolCtx: ToolContext = {
    profileId,
    conversationId,
    db,
    resolvedKeys: {
      openai: openaiResolved?.key,
      tavily: tavilyKey,
    },
    sandboxEnabled: settings.codeSandboxEnabled,
    computerAgentUrl: computerMode ? computerAgentUrl : undefined,
    computerAgentToken: computerMode ? computerAgentToken : undefined,
  };
  const { tools: builtinTools, enabledNames, connectorProviders } = await buildToolsForRequest({
    model,
    userPrefs: {
      toolsEnabled,
      webSearchEnabled,
      knowledgeBaseEnabled,
    },
    context: toolCtx,
  });

  let mcpBundle: Awaited<ReturnType<typeof buildMcpTools>> | null = null;
  if (toolsEnabled && model.capabilities.includes("tools")) {
    try {
      mcpBundle = await buildMcpTools(profileId);
    } catch (err) {
      console.error("[chat] MCP tool build failed", err);
    }
  }
  const tools = { ...builtinTools, ...(mcpBundle?.tools ?? {}) };

  let memoryBlock: string | null = null;
  if (profileForPrefs?.memoryUseInContext && userText) {
    try {
      const mems = await searchMemories(profileId, userText, undefined, { spaceId: conv.spaceId ?? null });
      memoryBlock = formatMemoriesForPrompt(mems) || null;
    } catch (err) {
      console.error("[chat] memory retrieval failed", err);
    }
  }

  let researchSessionId: string | null = null;
  if (researchMode && userText) {
    try {
      const created = await db.researchSession.create({
        data: {
          conversationId,
          query: userText.slice(0, 2000),
          status: "executing",
        },
      });
      researchSessionId = created.id;
    } catch (err) {
      console.error("[chat] research session create failed", err);
    }
  }

  const browserSidecarEnabled =
    process.env.OPENMLC_BROWSER_ENABLED === "true" && browserMode;
  // [spaces] Prepend the space's system prompt (if any) to the conversation
  // prompt so its operator-supplied directives apply to every chat in this space.
  const effectiveConvPrompt = (() => {
    if (conv.spaceId && conv.space?.systemPrompt) {
      const spaceBlock = `[space:${conv.space.name}]\n${conv.space.systemPrompt}`;
      return conv.systemPrompt ? `${spaceBlock}\n\n${conv.systemPrompt}` : spaceBlock;
    }
    return conv.systemPrompt;
  })();
  const systemBase = composeSystemPrompt({
    conversationPrompt: effectiveConvPrompt,
    personaPrompt: effectivePersonaPrompt,
    memoryBlock,
    researchPrompt: researchMode ? RESEARCH_PROMPT : null,
    browserEnabled: browserSidecarEnabled,
    computerEnabled: computerMode && !!computerAgentUrl,
  });
  const ragBlock = ragContext
    ? `\n\n[knowledge base context — relevant excerpts from the user's uploaded documents:\n${ragContext}\n]\nWhen using these excerpts, cite the source filename inline.`
    : "";
  const urlBlock = urlInjections.length > 0
    ? `\n\n[the user pasted ${urlInjections.length} URL(s) — pre-fetched contents:\n\n${urlInjections.join("\n\n---\n\n")}\n]\nWhen referencing these, mention the page title.`
    : "";
  const toolHint = toolsSystemPromptHint(enabledNames, connectorProviders);
  const systemPrompt = systemBase + ragBlock + urlBlock + toolHint;

  const providerOptions: Record<string, any> = {};
  if (reasoningEffort !== "off" && model.capabilities.includes("reasoning")) {
    if (model.providerId === "anthropic") {

      const budget = reasoningEffort === "high" ? 16000 : reasoningEffort === "medium" ? 6000 : 2000;
      providerOptions.anthropic = { thinking: { type: "enabled", budgetTokens: budget } };
    } else if (model.providerId === "openai") {
      providerOptions.openai = { reasoningEffort };
    } else if (model.providerId === "google") {
      const budget = reasoningEffort === "high" ? 16000 : reasoningEffort === "medium" ? 6000 : 2000;
      providerOptions.google = { thinkingConfig: { thinkingBudget: budget, includeThoughts: true } };
    }
  }

  let modelMessages: any[] = await convertToModelMessages(uiMessages);

  if ((imageAttachments.length > 0 && model.capabilities.includes("vision")) || textContext) {
    const imageParts =
      model.capabilities.includes("vision")
        ? await Promise.all(
            imageAttachments.map(async (att) => ({
              type: "image" as const,
              image: await imageToBuffer(att.path),
              mimeType: att.mimeType,
            }))
          )
        : [];

    modelMessages = modelMessages.map((msg, i) => {
      if (i !== modelMessages.length - 1 || msg.role !== "user") return msg;
      const base =
        typeof msg.content === "string"
          ? [{ type: "text" as const, text: msg.content + textContext }]
          : (msg.content as Array<{ type: string; text?: string }>).map((p) =>
              p.type === "text" ? { ...p, text: (p.text ?? "") + textContext } : p
            );
      return {
        ...msg,
        content: imageParts.length > 0 ? ([...base, ...imageParts] as typeof msg.content) : (base as typeof msg.content),
      };
    });
  }

  const result = streamText({
    model: provider,
    system: systemPrompt,
    messages: modelMessages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    stopWhen: stepCountIs(researchMode ? 40 : 25),
    abortSignal: req.signal,
    providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
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
          },
        });
        await db.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        if (usage?.inputTokens || usage?.outputTokens) {
          await recordUsage({
            profileId,
            providerId: model.providerId,
            modelId: model.id,
            providerModelId: model.providerModelId,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            messageId: assistantMsg.id,
          }).catch((err) => console.error("[chat] recordUsage failed", err));
        }

        const messageCount = await db.message.count({ where: { conversationId } });
        if (messageCount === 2) {
          const firstText = userText.split(/\n/)[0].slice(0, 80).trim();
          if (firstText && firstText.length > 1) {
            await db.conversation.update({
              where: { id: conversationId },
              data: { title: firstText },
            });
          }
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

        if (researchSessionId) {
          await db.researchSession.update({
            where: { id: researchSessionId },
            data: {
              status: "done",
              completedAt: new Date(),
              messageId: assistantMsg.id,
            },
          }).catch((err) => console.error("[chat] research session finish failed", err));

          // inbox: record research completion
          try {
            const finalized = await db.researchSession.findUnique({
              where: { id: researchSessionId },
              select: { query: true, sources: true },
            });
            let sourceCount = 0;
            try {
              const arr = JSON.parse(finalized?.sources ?? "[]");
              if (Array.isArray(arr)) sourceCount = arr.length;
            } catch { /* sources malformed — fall back to 0 */ }
            const queryText = (finalized?.query ?? userText ?? "research").trim();
            const titleText = queryText.length > 100 ? queryText.slice(0, 99) + "…" : queryText;
            await recordInboxEntry({
              profileId,
              kind: "research_done",
              title: titleText || "research",
              summary: sourceCount > 0
                ? `${sourceCount} source${sourceCount === 1 ? "" : "s"}`
                : "research complete",
              refType: "research_session",
              refId: researchSessionId,
            });
          } catch (err) {
            console.error("[chat] inbox entry (research) failed", err);
          }
        }
      } catch (err) {
        console.error("[chat] persist failed", err);
      } finally {
        if (mcpBundle) await mcpBundle.cleanup().catch(() => {});
      }

      extractMemoriesFromConversation(conversationId, profileId).catch((err) =>
        console.error("[chat] memory extraction failed", err),
      );
    },
  });

  const response = result.toUIMessageStreamResponse();
  response.headers.set("X-Key-Source", resolved.source);
  return response;
}

async function handleImageGen(
  model: { name: string; providerModelId: string; id: string },
  apiKey: string,
  prompt: string,
  conversationId: string,
  profileId: string,
) {
  void profileId;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.providerModelId,
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return Response.json(
        { error: (err as { error?: { message?: string } }).error?.message ?? "image generation failed" },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return Response.json({ error: "no image returned" }, { status: 500 });

    const filename = `${Date.now()}.png`;
    const genDir = join(process.cwd(), "public", "generated");
    await mkdir(genDir, { recursive: true });
    await writeFile(join(genDir, filename), Buffer.from(b64, "base64"));
    const publicUrl = `/generated/${filename}`;

    const markdown = `![Generated image — ${model.name}](${publicUrl})`;

    await db.message.create({
      data: { conversationId, role: "assistant", content: markdown, modelId: model.id },
    });
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const msgId = `img-${Date.now()}`;
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(enc.encode(`f:{"messageId":"${msgId}"}\n`));
        ctrl.enqueue(enc.encode(`0:${JSON.stringify(markdown)}\n`));
        ctrl.enqueue(
          enc.encode(`d:{"finishReason":"stop","usage":{"inputTokens":0,"outputTokens":0}}\n`)
        );
        ctrl.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    });
  } catch (err) {
    console.error("[image-gen] failed", err);
    return Response.json({ error: "image generation failed" }, { status: 500 });
  }
}

function extractText(message: UIMessage): string {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("");
  }

  if (typeof (message as any).content === "string") return (message as any).content;
  return "";
}
