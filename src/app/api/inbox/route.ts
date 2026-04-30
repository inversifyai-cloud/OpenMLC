import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getUnreadCount } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1" || url.searchParams.get("unread") === "true";
  const cursor = url.searchParams.get("cursor");
  const takeRaw = Number(url.searchParams.get("take") ?? "30");
  const take = Number.isFinite(takeRaw) ? Math.max(0, Math.min(100, Math.floor(takeRaw))) : 30;

  let entries: Array<{
    id: string;
    kind: string;
    title: string;
    summary: string | null;
    refType: string;
    refId: string;
    read: boolean;
    createdAt: string;
  }> = [];

  if (take > 0) {
    const rows = await db.inboxEntry.findMany({
      where: {
        profileId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
    });
    entries = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      summary: r.summary,
      refType: r.refType,
      refId: r.refId,
      read: r.read,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  const unreadCount = await getUnreadCount(profileId);
  return NextResponse.json({ entries, unreadCount });
}
