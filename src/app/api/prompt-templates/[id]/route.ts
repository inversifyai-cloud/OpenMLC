import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  body: z.string().min(1).max(4000).optional(),
  emoji: z.string().max(8).optional().nullable(),
  shortcut: z.string().max(40).optional().nullable(),
});

async function authOwn(id: string, profileId: string) {
  const t = await db.promptTemplate.findUnique({ where: { id }, select: { id: true, profileId: true } });
  if (!t || t.profileId !== profileId) return null;
  return t;
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

  const template = await db.promptTemplate.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ template });
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
  await db.promptTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
