import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ conversationId: string }> };

async function authOwn(conversationId: string) {
  const session = await getSession();
  if (!session.profileId) return { error: "unauthorized" as const, status: 401 };
  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, profileId: true },
  });
  if (!conv || conv.profileId !== session.profileId) return { error: "not_found" as const, status: 404 };
  return { error: null, status: 200 };
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;
  const auth = await authOwn(conversationId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Remove existing share if any, then create new
  await db.conversationShare.deleteMany({ where: { conversationId } });
  const slug = crypto.randomUUID().slice(0, 10);
  const share = await db.conversationShare.create({
    data: { conversationId, slug },
    select: { slug: true, createdAt: true },
  });
  return NextResponse.json({ slug: share.slug }, { status: 201 });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;
  const auth = await authOwn(conversationId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await db.conversationShare.deleteMany({ where: { conversationId } });
  return NextResponse.json({ ok: true });
}
