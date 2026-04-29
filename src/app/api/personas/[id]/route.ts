import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  emoji: z.string().max(8).optional().nullable(),
  systemPrompt: z.string().min(1).max(4000).optional(),
  description: z.string().max(280).optional().nullable(),
  defaultModel: z.string().max(80).optional().nullable(),
  toolsEnabled: z.array(z.string()).optional().nullable(),
  isDefault: z.boolean().optional(),
});

async function authOwn(id: string, profileId: string) {
  const p = await db.persona.findUnique({ where: { id }, select: { id: true, profileId: true } });
  if (!p || p.profileId !== profileId) return null;
  return p;
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

  const { toolsEnabled, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (toolsEnabled !== undefined) {
    data.toolsEnabled = toolsEnabled ? JSON.stringify(toolsEnabled) : null;
  }

  if (rest.isDefault === true) {
    await db.persona.updateMany({
      where: { profileId: session.profileId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  const persona = await db.persona.update({ where: { id }, data });
  return NextResponse.json({ persona });
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
  await db.persona.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
