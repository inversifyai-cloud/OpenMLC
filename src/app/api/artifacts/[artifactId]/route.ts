import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ artifactId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { artifactId } = await ctx.params;
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const artifact = await db.artifact.findUnique({
    where: { id: artifactId },
    include: {
      conversation: { select: { profileId: true } },
    },
  });

  if (!artifact || artifact.conversation.profileId !== session.profileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { conversation: _conv, ...rest } = artifact;
  return NextResponse.json({ artifact: rest });
}
