import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export type LibraryKind = "artifact" | "research" | "browser";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  title: string;
  subtitle: string;
  createdAt: string;
  conversationId: string | null;
  type?: string;
  language?: string | null;
  preview?: string;
}

const PAGE_SIZE = 30;

function shortPreview(text: string | null | undefined, n = 220): string {
  if (!text) return "";
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function hostFromUrl(u?: string | null): string {
  if (!u) return "";
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch { return u.slice(0, 60); }
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const type = (searchParams.get("type") ?? "all").trim() as LibraryKind | "all";
  const cursorRaw = searchParams.get("cursor");
  const cursor = cursorRaw ? new Date(cursorRaw) : null;
  const cursorFilter = cursor && !Number.isNaN(cursor.getTime())
    ? { createdAt: { lt: cursor } }
    : {};

  const includeArtifacts = type === "all" || type === "artifact";
  const includeResearch = type === "all" || type === "research";
  const includeBrowser = type === "all" || type === "browser";

  const take = PAGE_SIZE * (type === "all" ? 1 : 1);

  const ownedConvIds = (includeArtifacts || includeResearch)
    ? (
        await db.conversation.findMany({
          where: { profileId: session.profileId },
          select: { id: true },
        })
      ).map((c) => c.id)
    : [];

  const [artifacts, research, browser] = await Promise.all([
    includeArtifacts
      ? db.artifact.findMany({
          where: {
            conversationId: { in: ownedConvIds },
            ...cursorFilter,
            ...(q
              ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take,
          select: {
            id: true,
            title: true,
            type: true,
            language: true,
            content: true,
            createdAt: true,
            conversationId: true,
          },
        })
      : Promise.resolve([]),
    includeResearch
      ? db.researchSession.findMany({
          where: {
            conversationId: { in: ownedConvIds },
            ...cursorFilter,
            ...(q ? { query: { contains: q } } : {}),
          },
          orderBy: { createdAt: "desc" },
          take,
          select: {
            id: true,
            query: true,
            status: true,
            sources: true,
            createdAt: true,
            conversationId: true,
            completedAt: true,
          },
        })
      : Promise.resolve([]),
    includeBrowser
      ? db.browserSession.findMany({
          where: {
            profileId: session.profileId,
            ...cursorFilter,
            ...(q ? { startUrl: { contains: q } } : {}),
          },
          orderBy: { createdAt: "desc" },
          take,
          select: {
            id: true,
            startUrl: true,
            status: true,
            steps: true,
            createdAt: true,
            conversationId: true,
            closedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const items: LibraryItem[] = [];

  for (const a of artifacts) {
    items.push({
      id: a.id,
      kind: "artifact",
      title: a.title || "untitled artifact",
      subtitle: shortPreview(a.content, 140),
      createdAt: a.createdAt.toISOString(),
      conversationId: a.conversationId,
      type: a.type,
      language: a.language,
      preview: shortPreview(a.content, 220),
    });
  }
  for (const r of research) {
    let sourceCount = 0;
    try {
      const parsed = JSON.parse(r.sources);
      if (Array.isArray(parsed)) sourceCount = parsed.length;
    } catch {}
    items.push({
      id: r.id,
      kind: "research",
      title: r.query || "research",
      subtitle: `${r.status} · ${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
      createdAt: r.createdAt.toISOString(),
      conversationId: r.conversationId,
    });
  }
  for (const b of browser) {
    items.push({
      id: b.id,
      kind: "browser",
      title: hostFromUrl(b.startUrl) || "browser session",
      subtitle: `${b.status} · ${b.steps} step${b.steps === 1 ? "" : "s"}`,
      createdAt: b.createdAt.toISOString(),
      conversationId: b.conversationId,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const trimmed = items.slice(0, PAGE_SIZE);
  const nextCursor = trimmed.length === PAGE_SIZE
    ? trimmed[trimmed.length - 1].createdAt
    : null;

  return NextResponse.json({ items: trimmed, nextCursor });
}
