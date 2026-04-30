import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session.profileId)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  let cfg = await db.swarmConfig.findUnique({
    where: { profileId: session.profileId },
  });
  if (!cfg) {
    cfg = await db.swarmConfig.create({
      data: {
        profileId: session.profileId,
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
    enabledProviders = JSON.parse(cfg.enabledProviders);
  } catch {}
  return Response.json({
    config: {
      enabledProviders,
      minAgents: cfg.minAgents,
      maxAgents: cfg.maxAgents,
      reasoningEffort: cfg.reasoningEffort,
      supervisorModel: cfg.supervisorModel,
    },
  });
}

const patchSchema = z.object({
  enabledProviders: z.array(z.string()).optional(),
  minAgents: z.number().int().min(1).max(100).optional(),
  maxAgents: z.number().int().min(1).max(100).optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  supervisorModel: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.profileId)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json({ error: "invalid request" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.enabledProviders)
    data.enabledProviders = JSON.stringify(parsed.data.enabledProviders);
  if (typeof parsed.data.minAgents === "number")
    data.minAgents = parsed.data.minAgents;
  if (typeof parsed.data.maxAgents === "number")
    data.maxAgents = parsed.data.maxAgents;
  if (parsed.data.reasoningEffort)
    data.reasoningEffort = parsed.data.reasoningEffort;
  if (parsed.data.supervisorModel)
    data.supervisorModel = parsed.data.supervisorModel;

  if (
    typeof data.minAgents === "number" &&
    typeof data.maxAgents === "number" &&
    (data.minAgents as number) > (data.maxAgents as number)
  ) {
    return Response.json(
      { error: "minAgents must be <= maxAgents" },
      { status: 400 },
    );
  }

  const cfg = await db.swarmConfig.upsert({
    where: { profileId: session.profileId },
    update: data,
    create: {
      profileId: session.profileId,
      enabledProviders: parsed.data.enabledProviders
        ? JSON.stringify(parsed.data.enabledProviders)
        : "[]",
      minAgents: parsed.data.minAgents ?? 2,
      maxAgents: parsed.data.maxAgents ?? 5,
      reasoningEffort: parsed.data.reasoningEffort ?? "medium",
      supervisorModel: parsed.data.supervisorModel ?? "claude-sonnet-4-5",
    },
  });

  let enabledProviders: string[] = [];
  try {
    enabledProviders = JSON.parse(cfg.enabledProviders);
  } catch {}
  return Response.json({
    config: {
      enabledProviders,
      minAgents: cfg.minAgents,
      maxAgents: cfg.maxAgents,
      reasoningEffort: cfg.reasoningEffort,
      supervisorModel: cfg.supervisorModel,
    },
  });
}
