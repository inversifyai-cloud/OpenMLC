import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CronExpressionParser } from "cron-parser";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  cron: z.string().min(1).max(100),
  kind: z.enum(["chat", "swarm"]),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const schedules = await db.schedule.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });

  const { name, cron, kind, payload, enabled } = parsed.data;

  let nextRunAt: Date | null = null;
  try {
    const interval = CronExpressionParser.parse(cron, {});
    nextRunAt = interval.next().toDate();
  } catch {
    return NextResponse.json({ error: "invalid cron expression" }, { status: 400 });
  }

  const schedule = await db.schedule.create({
    data: {
      profileId: session.profileId,
      name,
      cron,
      kind,
      payload: JSON.stringify(payload),
      enabled,
      nextRunAt,
    },
  });

  return NextResponse.json({ schedule }, { status: 201 });
}
