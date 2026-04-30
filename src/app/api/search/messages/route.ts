import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { parseQuery } from "@/lib/search/parse-query";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 50;
const SNIPPET_RADIUS = 70; // ~140 chars total window

function makeSnippet(content: string, anchor: string | null): string {
  if (!content) return "";
  if (!anchor) {
    return content.length > SNIPPET_RADIUS * 2
      ? content.slice(0, SNIPPET_RADIUS * 2).trimEnd() + "…"
      : content;
  }
  const lc = content.toLowerCase();
  const idx = lc.indexOf(anchor.toLowerCase());
  if (idx < 0) {
    return content.length > SNIPPET_RADIUS * 2
      ? content.slice(0, SNIPPET_RADIUS * 2).trimEnd() + "…"
      : content;
  }
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(content.length, idx + anchor.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";
  return prefix + content.slice(start, end) + suffix;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ matches: [] }, { status: 401 });
  }
  const profileId = session.profileId;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ matches: [] });
  }

  const parsed = parseQuery(q);

  // Resolve space filter to an id if it's a name.
  let spaceIdFilter: string | null = null;
  if (parsed.spaceFilter) {
    if (parsed.spaceFilter.kind === "id") {
      spaceIdFilter = parsed.spaceFilter.value;
    } else {
      const space = await db.space.findFirst({
        where: {
          profileId,
          name: { contains: parsed.spaceFilter.value },
        },
        select: { id: true },
      });
      if (space) spaceIdFilter = space.id;
      else {
        // No matching space — short-circuit to empty result instead of
        // returning unrelated messages.
        return NextResponse.json({ matches: [] });
      }
    }
  }

  // Build content AND-filter from terms + phrases.
  const contentNeedles: string[] = [
    ...parsed.terms,
    ...parsed.phrases,
  ].filter((s) => s.length > 0);

  const contentAnd: Prisma.MessageWhereInput[] = contentNeedles.map((t) => ({
    content: { contains: t },
  }));

  const dateFilter: Prisma.DateTimeFilter | undefined =
    parsed.before || parsed.after
      ? {
          ...(parsed.after ? { gte: parsed.after } : {}),
          ...(parsed.before ? { lte: parsed.before } : {}),
        }
      : undefined;

  const where: Prisma.MessageWhereInput = {
    supersededAt: null,
    conversation: {
      profileId,
      ...(spaceIdFilter ? { spaceId: spaceIdFilter } : {}),
    },
    ...(parsed.from ? { role: parsed.from } : {}),
    ...(parsed.model ? { modelId: { contains: parsed.model } } : {}),
    ...(parsed.convId ? { conversationId: parsed.convId } : {}),
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(contentAnd.length > 0 ? { AND: contentAnd } : {}),
  };

  // If there are no needles AND no filters at all, we'd return everything —
  // bail to keep the index cheap.
  const hasAnyConstraint =
    contentAnd.length > 0 ||
    !!parsed.from ||
    !!parsed.model ||
    !!parsed.convId ||
    !!dateFilter ||
    !!spaceIdFilter;
  if (!hasAnyConstraint) {
    return NextResponse.json({ matches: [] });
  }

  const rows = await db.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_RESULTS,
    select: {
      id: true,
      conversationId: true,
      role: true,
      modelId: true,
      content: true,
      createdAt: true,
      conversation: { select: { title: true } },
    },
  });

  const anchor = contentNeedles[0] ?? null;

  const matches = rows.map((r) => ({
    messageId: r.id,
    conversationId: r.conversationId,
    conversationTitle: r.conversation?.title ?? "untitled",
    role: r.role as "user" | "assistant",
    modelId: r.modelId ?? null,
    snippet: makeSnippet(r.content, anchor),
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ matches });
}
