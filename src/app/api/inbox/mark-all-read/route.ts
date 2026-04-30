import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await db.inboxEntry.updateMany({
    where: { profileId: session.profileId, read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true, updated: res.count });
}
