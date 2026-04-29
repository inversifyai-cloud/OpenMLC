import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.webhook.findFirst({ where: { id, profileId: session.profileId } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.webhook.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
