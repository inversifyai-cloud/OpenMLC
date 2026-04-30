import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ spaceId: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { spaceId } = await ctx.params;

  const existing = await db.space.findUnique({
    where: { id: spaceId },
    select: { id: true, profileId: true, archived: true },
  });
  if (!existing || existing.profileId !== session.profileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const space = await db.space.update({
    where: { id: spaceId },
    data: { archived: !existing.archived },
    select: { id: true, archived: true },
  });
  return NextResponse.json({ space });
}
