import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const byTitle = await db.conversation.findMany({
    where: {
      profileId: session.profileId,
      archived: false,
      title: { contains: q },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, title: true, modelId: true, updatedAt: true },
  });

  const byMessage = await db.message.findMany({
    where: {
      conversation: { profileId: session.profileId, archived: false },
      content: { contains: q },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      conversationId: true,
      content: true,
      conversation: { select: { id: true, title: true, modelId: true, updatedAt: true } },
    },
  });

  const seen = new Set<string>(byTitle.map((c) => c.id));
  const merged: { id: string; title: string; modelId: string; updatedAt: Date; snippet?: string }[] = byTitle.map((c) => ({ ...c }));

  for (const m of byMessage) {
    if (seen.has(m.conversationId)) continue;
    seen.add(m.conversationId);

    const idx = m.content.toLowerCase().indexOf(q.toLowerCase());
    const start = Math.max(0, idx - 40);
    const end = Math.min(m.content.length, idx + q.length + 80);
    const snippet = (start > 0 ? "…" : "") + m.content.slice(start, end) + (end < m.content.length ? "…" : "");
    merged.push({ ...m.conversation, snippet });
  }

  merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json({ results: merged.slice(0, 30) });
}
