import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { orchestrateSwarm } from "@/lib/swarm/orchestrate";
import { getOrCreateBus } from "@/lib/swarm/stream-bus";

const bodySchema = z.object({
  prompt: z.string().min(1).max(8000),
  conversationId: z.string().optional(),

  override: z
    .object({
      minAgents: z.number().int().min(1).max(10).optional(),
      maxAgents: z.number().int().min(1).max(10).optional(),
      reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
      enabledProviders: z.array(z.string()).optional(),
      supervisorModel: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.profileId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

  const settings = await getSettings();
  if (!settings.swarmEnabled) {
    return Response.json({ error: "swarm disabled by operator" }, { status: 403 });
  }

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
      { status: 400 },
    );
  }
  const { prompt, conversationId, override } = parsed.data;

  let config = await db.swarmConfig.findUnique({ where: { profileId } });
  if (!config) {
    config = await db.swarmConfig.create({
      data: {
        profileId,
        enabledProviders: "[]",
        minAgents: 2,
        maxAgents: 5,
        reasoningEffort: "medium",
        supervisorModel: "claude-sonnet-4-5",
      },
    });
  }

  let enabledProviders: string[] = [];
  try {
    enabledProviders = JSON.parse(config.enabledProviders);
  } catch {}

  const finalConfig = {
    enabledProviders: override?.enabledProviders ?? enabledProviders,
    minAgents: override?.minAgents ?? config.minAgents,
    maxAgents: override?.maxAgents ?? config.maxAgents,
    reasoningEffort: (override?.reasoningEffort ?? config.reasoningEffort) as
      | "low"
      | "medium"
      | "high",
    supervisorModel: override?.supervisorModel ?? config.supervisorModel,
  };

  if (conversationId) {
    try {
      const conv = await db.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, profileId: true },
      });
      if (conv && conv.profileId === profileId) {
        await db.message.create({
          data: {
            conversationId,
            role: "user",
            content: prompt,
            modelId: finalConfig.supervisorModel,
          },
        });
        await db.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date(), modelId: finalConfig.supervisorModel },
        });
      }
    } catch (err) {
      console.error("[swarm] failed to persist user message", err);
    }
  }

  const run = await db.swarmRun.create({
    data: {
      profileId,
      conversationId: conversationId ?? null,
      prompt,
      status: "planning",
    },
  });

  const bus = getOrCreateBus(run.id);

  orchestrateSwarm({
    profileId,
    swarmRunId: run.id,
    prompt,
    conversationId: conversationId ?? null,
    config: finalConfig,
  }).catch((err) => {
    console.error("[swarm] orchestrate threw outer", err);
  });

  return new Response(bus.toReadableStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Swarm-Run-Id": run.id,
    },
  });
}

export async function GET() {
  const session = await getSession();
  if (!session.profileId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const runs = await db.swarmRun.findMany({
    where: { profileId: session.profileId },
    orderBy: { startedAt: "desc" },
    take: 30,
    select: {
      id: true,
      prompt: true,
      status: true,
      startedAt: true,
      completedAt: true,
      _count: { select: { agents: true } },
    },
  });
  return Response.json({ runs });
}
