import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ conversationId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { profileId: true },
  });
  if (!conv || conv.profileId !== session.profileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const artifacts = await db.artifact.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ artifacts });
}
