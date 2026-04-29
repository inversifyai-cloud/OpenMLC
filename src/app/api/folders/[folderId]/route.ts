import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ folderId: string }> };

async function authOwnFolder(folderId: string) {
  const session = await getSession();
  if (!session.profileId) return { error: "unauthorized" as const, status: 401 };
  const folder = await db.folder.findUnique({ where: { id: folderId }, select: { id: true, profileId: true } });
  if (!folder || folder.profileId !== session.profileId) return { error: "not_found" as const, status: 404 };
  return { error: null, status: 200 };
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { folderId } = await ctx.params;
  const auth = await authOwnFolder(folderId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const folder = await db.folder.update({ where: { id: folderId }, data: parsed.data });
  return NextResponse.json({ folder });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { folderId } = await ctx.params;
  const auth = await authOwnFolder(folderId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await db.conversation.updateMany({ where: { folderId }, data: { folderId: null } });
  await db.folder.delete({ where: { id: folderId } });
  return NextResponse.json({ ok: true });
}
