import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ provider: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { provider } = await ctx.params;
  await db.profileApiKey
    .delete({ where: { profileId_provider: { profileId: session.profileId, provider } } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
