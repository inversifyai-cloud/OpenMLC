
import { NextResponse } from "next/server";
import { streamText, generateText } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { findModel } from "@/lib/providers/catalog";
import { getProviderModel } from "@/lib/providers";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { recordUsage } from "@/lib/usage/record";

async function authenticate(req: Request): Promise<{ profileId: string } | null> {
  const envKey = process.env.OPENMLC_API_KEY;
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (envKey) {
    if (bearer !== envKey) return null;
  }

  const profile = await db.profile.findFirst({ select: { id: true } });
  if (!profile) return null;
  return { profileId: profile.id };
}

type OAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
};

function oaiToModelMessages(messages: OAIMessage[]) {
  return messages
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content ?? "",
    }));
}

const requestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant", "tool"]),
    content: z.union([z.string(), z.null()]).optional().transform(v => v ?? null),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
  })),
  stream: z.boolean().optional().default(false),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
});

function makeId() {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nonStreamResponse(id: string, model: string, text: string, inputTokens?: number, outputTokens?: number) {
  return NextResponse.json({
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content: text },
      finish_reason: "stop",
    }],
    usage: {
      prompt_tokens: inputTokens ?? 0,
      completion_tokens: outputTokens ?? 0,
      total_tokens: (inputTokens ?? 0) + (outputTokens ?? 0),
    },
  });
}

function sseChunk(id: string, model: string, delta: string, finishReason?: string) {
  const payload = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: finishReason ? {} : { role: "assistant", content: delta },
      finish_reason: finishReason ?? null,
    }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: { message: "Unauthorized", type: "authentication_error" } }, { status: 401 });
  }
  const { profileId } = auth;

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: { message: "Invalid JSON", type: "invalid_request_error" } }, { status: 400 }); }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid request", type: "invalid_request_error", details: parsed.error.flatten() } }, { status: 400 });
  }
  const { model: modelId, messages, stream, max_tokens, temperature } = parsed.data;

  const model = await findModel(modelId, profileId);
  if (!model) {
    return NextResponse.json({ error: { message: `Model '${modelId}' not found`, type: "invalid_request_error" } }, { status: 404 });
  }

  const resolved = await resolveProviderKey(profileId, model.providerId);
  if (!resolved) {
    return NextResponse.json(
      { error: { message: `No API key configured for provider '${model.providerId}'`, type: "invalid_request_error" } },
      { status: 402 }
    );
  }

  const provider = getProviderModel(model.providerId, model.providerModelId, resolved.key, resolved.baseUrl);

  const systemMessages = (messages as OAIMessage[]).filter((m) => m.role === "system");
  const chatMessages = (messages as OAIMessage[]).filter((m) => m.role !== "system");
  const system = systemMessages.map((m) => m.content ?? "").join("\n").trim() || undefined;
  const modelMessages = oaiToModelMessages(chatMessages);

  const completionId = makeId();

  if (stream) {
    const enc = new TextEncoder();
    const readable = new ReadableStream({
      async start(ctrl) {
        try {
          const result = streamText({
            model: provider,
            system,
            messages: modelMessages,
            maxOutputTokens: max_tokens,
            temperature,
            abortSignal: req.signal,
          });
          for await (const chunk of result.textStream) {
            ctrl.enqueue(enc.encode(sseChunk(completionId, modelId, chunk)));
          }
          ctrl.enqueue(enc.encode(sseChunk(completionId, modelId, "", "stop")));
          ctrl.enqueue(enc.encode("data: [DONE]\n\n"));

          const usage = await result.usage;
          if (usage?.inputTokens || usage?.outputTokens) {
            recordUsage({
              profileId,
              providerId: model.providerId,
              modelId: model.id,
              providerModelId: model.providerModelId,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
            }).catch((err) => console.error("[v1/completions] recordUsage failed", err));
          }
        } catch (err) {
          console.error("[v1/chat/completions] stream error", err);
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: { message: String(err) } })}\n\n`));
        } finally {
          ctrl.close();
        }
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await generateText({
      model: provider,
      system,
      messages: modelMessages,
      maxOutputTokens: max_tokens,
      temperature,
    });

    if (result.usage?.inputTokens || result.usage?.outputTokens) {
      recordUsage({
        profileId,
        providerId: model.providerId,
        modelId: model.id,
        providerModelId: model.providerModelId,
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      }).catch((err) => console.error("[v1/completions] recordUsage failed", err));
    }
    return nonStreamResponse(completionId, modelId, result.text, result.usage?.inputTokens, result.usage?.outputTokens);
  } catch (err) {
    console.error("[v1/chat/completions] error", err);
    return NextResponse.json({ error: { message: String(err), type: "server_error" } }, { status: 500 });
  }
}
