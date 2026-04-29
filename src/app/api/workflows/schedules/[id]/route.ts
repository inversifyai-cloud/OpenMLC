import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CronExpressionParser } from "cron-parser";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  cron: z.string().min(1).max(100).optional(),
  kind: z.enum(["chat", "swarm"]).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.schedule.findFirst({ where: { id, profileId: session.profileId } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.kind !== undefined) data.kind = parsed.data.kind;
  if (parsed.data.payload !== undefined) data.payload = JSON.stringify(parsed.data.payload);
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;

  if (parsed.data.cron !== undefined) {
    try {
      const interval = CronExpressionParser.parse(parsed.data.cron, {});
      data.cron = parsed.data.cron;
      data.nextRunAt = interval.next().toDate();
    } catch {
      return NextResponse.json({ error: "invalid cron expression" }, { status: 400 });
    }
  }

  const schedule = await db.schedule.update({ where: { id }, data });
  return NextResponse.json({ schedule });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.schedule.findFirst({ where: { id, profileId: session.profileId } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.schedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
