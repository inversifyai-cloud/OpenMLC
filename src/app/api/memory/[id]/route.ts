import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { embedMemoryText } from "@/lib/ai/memory";

const updateSchema = z.object({
  text: z.string().min(2).max(800).optional(),
  pinned: z.boolean().optional(),
  active: z.boolean().optional(),
});

async function authOwn(memoryId: string, profileId: string) {
  const m = await db.memory.findUnique({ where: { id: memoryId }, select: { id: true, profileId: true } });
  if (!m || m.profileId !== profileId) return null;
  return m;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const own = await authOwn(id, session.profileId);
  if (!own) return NextResponse.json({ error: "not found" }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (typeof parsed.data.text === "string") {
    const embedding = await embedMemoryText(session.profileId, parsed.data.text);
    if (embedding) data.embedding = embedding;
  }

  const memory = await db.memory.update({ where: { id }, data });
  return NextResponse.json({ memory });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const own = await authOwn(id, session.profileId);
  if (!own) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.memory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
