import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createMemory } from "@/lib/ai/memory";

const createSchema = z.object({
  text: z.string().min(2).max(800),
  pinned: z.boolean().optional().default(false),
});

const prefsSchema = z.object({
  memoryAutoExtract: z.boolean().optional(),
  memoryUseInContext: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [memories, profile] = await Promise.all([
    db.memory.findMany({
      where: { profileId: session.profileId },
      orderBy: [{ pinned: "desc" }, { active: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        text: true,
        source: true,
        pinned: true,
        active: true,
        sourceConvId: true,
        createdAt: true,
      },
    }),
    db.profile.findUnique({
      where: { id: session.profileId },
      select: { memoryAutoExtract: true, memoryUseInContext: true },
    }),
  ]);
  return NextResponse.json({
    memories,
    prefs: {
      memoryAutoExtract: profile?.memoryAutoExtract ?? true,
      memoryUseInContext: profile?.memoryUseInContext ?? true,
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  const memory = await createMemory(session.profileId, parsed.data.text, {
    source: "manual",
    pinned: parsed.data.pinned,
  });
  return NextResponse.json({ memory }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = prefsSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const updated = await db.profile.update({
    where: { id: session.profileId },
    data: parsed.data,
    select: { memoryAutoExtract: true, memoryUseInContext: true },
  });
  return NextResponse.json({ prefs: updated });
}

export async function DELETE() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await db.memory.deleteMany({ where: { profileId: session.profileId } });
  return NextResponse.json({ deleted: result.count });
}
