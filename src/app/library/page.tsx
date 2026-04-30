import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/chrome/AppShell";
import { LibraryGrid, type LibraryItem } from "@/components/library/LibraryGrid";
import { LibraryTabs } from "@/components/library/LibraryTabs";
import { LibraryFilters } from "@/components/library/LibraryFilters";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

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

export default async function LibraryPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const typeRaw = sp.type ?? "all";
  const type = (["artifact", "research", "browser"].includes(typeRaw) ? typeRaw : "all") as
    | "artifact"
    | "research"
    | "browser"
    | "all";

  const includeArtifacts = type === "all" || type === "artifact";
  const includeResearch = type === "all" || type === "research";
  const includeBrowser = type === "all" || type === "browser";

  const profileId = session.profileId;

  const ownedConvs = await db.conversation.findMany({
    where: { profileId },
    select: { id: true },
  });
  const ownedConvIds = ownedConvs.map((c) => c.id);

  const [artifacts, research, browser, totals] = await Promise.all([
    includeArtifacts
      ? db.artifact.findMany({
          where: {
            conversationId: { in: ownedConvIds },
            ...(q
              ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 60,
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
            ...(q ? { query: { contains: q } } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: {
            id: true,
            query: true,
            status: true,
            sources: true,
            createdAt: true,
            conversationId: true,
          },
        })
      : Promise.resolve([]),
    includeBrowser
      ? db.browserSession.findMany({
          where: {
            profileId,
            ...(q ? { startUrl: { contains: q } } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: {
            id: true,
            startUrl: true,
            status: true,
            steps: true,
            createdAt: true,
            conversationId: true,
          },
        })
      : Promise.resolve([]),
    Promise.all([
      db.artifact.count({ where: { conversationId: { in: ownedConvIds } } }),
      db.researchSession.count({ where: { conversationId: { in: ownedConvIds } } }),
      db.browserSession.count({ where: { profileId } }),
    ]),
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
    });
  }
  for (const r of research) {
    let n = 0;
    try {
      const parsed = JSON.parse(r.sources);
      if (Array.isArray(parsed)) n = parsed.length;
    } catch {}
    items.push({
      id: r.id,
      kind: "research",
      title: r.query || "research",
      subtitle: `${r.status} · ${n} source${n === 1 ? "" : "s"}`,
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
  const initialCursor = trimmed.length === PAGE_SIZE
    ? trimmed[trimmed.length - 1].createdAt
    : null;

  const [artCount, resCount, brwCount] = totals;
  const totalAll = artCount + resCount + brwCount;

  const totalLabel =
    type === "all"
      ? `${totalAll} entr${totalAll === 1 ? "y" : "ies"}`
      : type === "artifact"
        ? `${artCount} figure${artCount === 1 ? "" : "s"}`
        : type === "research"
          ? `${resCount} research session${resCount === 1 ? "" : "s"}`
          : `${brwCount} browser session${brwCount === 1 ? "" : "s"}`;

  return (
    <div>
      <PageHeader
        kicker="archive"
        title="library"
        subtitle={`${artCount} figures · ${resCount} research · ${brwCount} browser sessions`}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
        <LibraryTabs />
        <LibraryFilters />
      </div>
      <LibraryGrid
        initialItems={trimmed}
        initialCursor={initialCursor}
        totalLabel={totalLabel}
      />
    </div>
  );
}
