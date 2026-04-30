import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: RouteCtx) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const entry = await db.inboxEntry.findUnique({
    where: { id },
    select: { id: true, profileId: true },
  });
  if (!entry || entry.profileId !== session.profileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.inboxEntry.update({
    where: { id },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
