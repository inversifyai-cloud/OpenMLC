import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getConnector } from "@/lib/connectors";

export async function POST(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { provider } = await ctx.params;
  if (!getConnector(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  await db.connector.deleteMany({
    where: { profileId: session.profileId, provider },
  });
  return NextResponse.json({ ok: true });
}
