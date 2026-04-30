import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { findModel } from "@/lib/providers/catalog";

type RouteCtx = { params: Promise<{ spaceId: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  emoji: z.string().max(8).nullable().optional(),
  description: z.string().max(280).nullable().optional(),
  systemPrompt: z.string().max(8000).nullable().optional(),
  defaultPersonaId: z.string().min(1).nullable().optional(),
  defaultModel: z.string().max(80).nullable().optional(),
  archived: z.boolean().optional(),
  position: z.number().int().optional(),
});

async function authOwn(spaceId: string, profileId: string) {
  const space = await db.space.findUnique({
    where: { id: spaceId },
    select: { id: true, profileId: true },
  });
  if (!space || space.profileId !== profileId) return null;
  return space;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { spaceId } = await ctx.params;
  const own = await authOwn(spaceId, session.profileId);
  if (!own) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const space = await db.space.findUnique({
    where: { id: spaceId },
    include: {
      _count: { select: { conversations: true, knowledgeFiles: true, memories: true } },
    },
  });
  return NextResponse.json({ space });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { spaceId } = await ctx.params;
  const own = await authOwn(spaceId, session.profileId);
  if (!own) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (data.defaultPersonaId) {
    const persona = await db.persona.findUnique({
      where: { id: data.defaultPersonaId },
      select: { profileId: true },
    });
    if (!persona || persona.profileId !== session.profileId) {
      return NextResponse.json({ error: "unknown persona" }, { status: 400 });
    }
  }
  if (data.defaultModel && !(await findModel(data.defaultModel, session.profileId))) {
    return NextResponse.json({ error: "unknown model" }, { status: 400 });
  }

  const space = await db.space.update({
    where: { id: spaceId },
    data: {
      ...data,
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.emoji !== undefined ? { emoji: data.emoji?.trim() || null } : {}),
    },
  });
  return NextResponse.json({ space });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { spaceId } = await ctx.params;
  const own = await authOwn(spaceId, session.profileId);
  if (!own) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Relations are onDelete: SetNull on Conversation/KnowledgeFile/Memory.
  await db.space.delete({ where: { id: spaceId } });
  return NextResponse.json({ ok: true });
}
