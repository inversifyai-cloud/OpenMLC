import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { findModel } from "@/lib/providers/catalog";
import { getProviderModel } from "@/lib/providers";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { composeSystemPrompt } from "@/lib/ai/system-prompts";
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

const bodySchema = z.object({
  messages: z.array(z.any()),
  modelId: z.string().min(1),
  conversationId: z.string().min(1),
  attachmentIds: z.array(z.string()).optional(),
  reasoningEffort: z.enum(["off", "low", "medium", "high"]).optional(),
  toolsEnabled: z.boolean().optional(),
  webSearchEnabled: z.boolean().optional(),
  knowledgeBaseEnabled: z.boolean().optional(),
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
      persona: { select: { systemPrompt: true } },
    },
  });
  if (!conv || conv.profileId !== profileId) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }

  const profileForPrefs = await db.profile.findUnique({
    where: { id: profileId },
    select: { memoryUseInContext: true },
  });

  const resolved = await resolveProviderKey(profileId, model.providerId);
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
      ragContext = await buildRAGContext(profileId, userText, { maxChars: 6000 });
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
  const toolCtx: ToolContext = {
    profileId,
    conversationId,
    db,
    resolvedKeys: {
      openai: openaiResolved?.key,
      tavily: tavilyKey,
    },
    sandboxEnabled: settings.codeSandboxEnabled,
  };
  const { tools: builtinTools, enabledNames } = buildToolsForRequest({
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
      const mems = await searchMemories(profileId, userText);
      memoryBlock = formatMemoriesForPrompt(mems) || null;
    } catch (err) {
      console.error("[chat] memory retrieval failed", err);
    }
  }

  const systemBase = composeSystemPrompt({
    conversationPrompt: conv.systemPrompt,
    personaPrompt: conv.persona?.systemPrompt ?? null,
    memoryBlock,
  });
  const ragBlock = ragContext
    ? `\n\n[knowledge base context — relevant excerpts from the user's uploaded documents:\n${ragContext}\n]\nWhen using these excerpts, cite the source filename inline.`
    : "";
  const urlBlock = urlInjections.length > 0
    ? `\n\n[the user pasted ${urlInjections.length} URL(s) — pre-fetched contents:\n\n${urlInjections.join("\n\n---\n\n")}\n]\nWhen referencing these, mention the page title.`
    : "";
  const toolHint = toolsSystemPromptHint(enabledNames);
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
    stopWhen: stepCountIs(5),
    abortSignal: req.signal,
    providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
    onFinish: async ({ text, usage, reasoningText }) => {
      if (!text) return;
      try {
        const assistantMsg = await db.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: text,
            modelId: model.id,
            reasoning: reasoningText ?? null,
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
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
