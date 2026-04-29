import { streamText } from "ai";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { findModel } from "@/lib/providers/catalog";
import { getProviderModel } from "@/lib/providers";
import { resolveProviderKey } from "@/lib/providers/resolve-key";

const bodySchema = z.object({
  prompt: z.string().min(1),
  modelIds: z.array(z.string().min(1)).min(2).max(4),
  conversationId: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
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
    return Response.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { prompt, modelIds } = parsed.data;

  // Resolve all models and provider keys up front
  const resolved = await Promise.all(
    modelIds.map(async (modelId) => {
      const model = await findModel(modelId, profileId);
      if (!model) return { modelId, error: `unknown model: ${modelId}` };

      const key = await resolveProviderKey(profileId, model.providerId);
      if (!key) return { modelId, error: `no_api_key for ${model.providerId}` };

      const provider = getProviderModel(
        model.providerId,
        model.providerModelId,
        key.key,
        key.baseUrl
      );

      return { modelId, model, key, provider };
    })
  );

  // Check for any resolution errors
  for (const r of resolved) {
    if ("error" in r && r.error) {
      return Response.json({ error: r.error }, { status: 400 });
    }
  }

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      function send(data: object) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      // Fan out streamText per model in parallel
      await Promise.all(
        resolved.map(async (r) => {
          if ("error" in r && r.error) return;
          const { modelId, provider } = r as Exclude<typeof r, { error: string }>;

          try {
            const result = streamText({
              model: provider,
              prompt,
              maxOutputTokens: 2048,
              abortSignal: req.signal,
            });

            for await (const delta of result.textStream) {
              send({ modelId, type: "delta", text: delta });
            }

            const usage = await result.usage;
            send({
              modelId,
              type: "done",
              usage: {
                inputTokens: usage?.inputTokens ?? 0,
                outputTokens: usage?.outputTokens ?? 0,
              },
            });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "stream error";
            send({ modelId, type: "error", error: message });
          }
        })
      );

      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
