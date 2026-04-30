import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { TopRail } from "@/components/chat/TopRail";
import { HomeHeader, buildDateLabel } from "@/components/home/HomeHeader";
import { RecentLibrary, type RecentItem } from "@/components/home/RecentLibrary";
import { TopSpaces, type TopSpaceRow } from "@/components/home/TopSpaces";
import { UpcomingRuns, type UpcomingRow } from "@/components/home/UpcomingRuns";
import { InboxPreview, type InboxPreviewRow } from "@/components/home/InboxPreview";

export const dynamic = "force-dynamic";

type ArtifactType = RecentItem extends { kind: "artifact"; type: infer T } ? T : never;

const ARTIFACT_TYPE_SET: ReadonlySet<string> = new Set([
  "code",
  "html",
  "svg",
  "markdown",
  "react",
  "mermaid",
  "chart",
]);

function ymdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function truncateTitle(s: string, n = 64): string {
  const trimmed = s.trim();
  if (trimmed.length <= n) return trimmed;
  return trimmed.slice(0, n - 1) + "…";
}

export default async function Home() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  // Step 2 — load profile, decide start screen.
  const profile = await db.profile.findUnique({
    where: { id: session.profileId },
    select: { displayName: true, startScreen: true },
  });
  if (!profile) redirect("/profiles");
  if (profile.startScreen === "chat") redirect("/chat");

  const profileId = session.profileId;
  const now = new Date();

  // Build the last-7-days YYYY-MM-DD set (oldest → newest), in local time
  // for the user. We use UTC to match how usage rows are written.
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(ymdUTC(d));
  }
  const earliestDay = dayKeys[0];

  // ResearchSession has no relation back to Profile; scope via conversation IDs.
  const profileConvIds = (
    await db.conversation.findMany({
      where: { profileId },
      select: { id: true },
    })
  ).map((c) => c.id);

  // Step 3 — parallel fetch.
  const [
    usageRows,
    artifactsRaw,
    researchRaw,
    browserRaw,
    spaceRows,
    schedules,
    inboxRows,
    lastConv,
  ] = await Promise.all([
    db.usageDaily.findMany({
      where: { profileId, day: { gte: earliestDay } },
      select: { day: true, costUsd: true },
    }),
    db.artifact.findMany({
      where: { conversation: { profileId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        title: true,
        language: true,
        content: true,
        createdAt: true,
      },
    }),
    profileConvIds.length > 0
      ? db.researchSession.findMany({
          where: { conversationId: { in: profileConvIds } },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: { id: true, query: true, createdAt: true },
        })
      : Promise.resolve([] as { id: string; query: string; createdAt: Date }[]),
    db.browserSession.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, startUrl: true, createdAt: true },
    }),
    db.space.findMany({
      where: { profileId, archived: false },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        emoji: true,
        updatedAt: true,
        conversations: {
          select: { id: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    db.schedule.findMany({
      where: { profileId, enabled: true, nextRunAt: { not: null, gte: now } },
      orderBy: { nextRunAt: "asc" },
      take: 5,
      select: { id: true, name: true, cron: true, nextRunAt: true },
    }),
    db.inboxEntry.findMany({
      where: { profileId, read: false },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, kind: true, title: true, summary: true, createdAt: true },
    }),
    db.conversation.findFirst({
      where: { profileId, archived: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  // ── Spend / sparkline ──────────────────────────────────────────
  const spendByDay = new Map<string, number>();
  for (const k of dayKeys) spendByDay.set(k, 0);
  for (const row of usageRows) {
    spendByDay.set(row.day, (spendByDay.get(row.day) ?? 0) + row.costUsd);
  }
  const spark = dayKeys.map((k) => spendByDay.get(k) ?? 0);
  const todayKey = dayKeys[dayKeys.length - 1];
  const todaySpend = spendByDay.get(todayKey) ?? 0;
  const weekSpend = spark.reduce((s, v) => s + v, 0);

  // ── Recent library — union of artifact / research / browser ────
  const artifacts: RecentItem[] = artifactsRaw
    .filter((a) => ARTIFACT_TYPE_SET.has(a.type))
    .map((a) => ({
      kind: "artifact" as const,
      id: a.id,
      type: a.type as ArtifactType,
      title: a.title,
      language: a.language,
      content: a.content,
      createdAt: a.createdAt,
    }));
  const research: RecentItem[] = researchRaw.map((r) => ({
    kind: "research" as const,
    id: r.id,
    query: r.query,
    createdAt: r.createdAt,
  }));
  const browser: RecentItem[] = browserRaw.map((b) => ({
    kind: "browser" as const,
    id: b.id,
    startUrl: b.startUrl,
    createdAt: b.createdAt,
  }));
  const recent: RecentItem[] = [...artifacts, ...research, ...browser]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 4);

  // ── Top spaces (by most recent conversation activity, take 3) ──
  const topSpaces: TopSpaceRow[] = spaceRows
    .map((s) => {
      const lastActivity =
        s.conversations.length > 0 ? s.conversations[0].updatedAt : null;
      return {
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        chatCount: s.conversations.length,
        // Fall back to space's own updatedAt if no conversations
        lastActivity: lastActivity ?? s.updatedAt ?? null,
      };
    })
    .sort((a, b) => {
      const at = a.lastActivity ? a.lastActivity.getTime() : 0;
      const bt = b.lastActivity ? b.lastActivity.getTime() : 0;
      return bt - at;
    })
    .slice(0, 3);

  // ── Upcoming ───────────────────────────────────────────────────
  const upcoming: UpcomingRow[] = schedules.map((s) => ({
    id: s.id,
    name: s.name,
    cron: s.cron,
    nextRunAt: s.nextRunAt,
  }));

  // ── Inbox preview ──────────────────────────────────────────────
  const inbox: InboxPreviewRow[] = inboxRows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    createdAt: r.createdAt,
  }));

  const dateLabel = buildDateLabel(now);

  return (
    <div className="home-shell">
      <TopRail />
      <div className="home-scroll">
        <main className="home-page">
          <HomeHeader
            displayName={profile.displayName}
            todaySpend={todaySpend}
            weekSpend={weekSpend}
            spark={spark}
            dateLabel={dateLabel}
          />

          {/* B — continue / start chat */}
          <section className="home-section home-continue">
            {lastConv ? (
              <Link href={`/chat/${lastConv.id}`} className="home-continue__sentence">
                Pick up where you left off —{" "}
                <em>{truncateTitle(lastConv.title || "untitled conversation")}</em>
              </Link>
            ) : (
              <span className="home-continue__sentence">
                Begin a new line of thought.
              </span>
            )}
            <div className="home-continue__row">
              <Link href="/chat" className="home-link-mono">
                {lastConv ? "or start a new chat →" : "Start a new chat →"}
              </Link>
              <Link href="/chat" className="home-skip" aria-label="Skip the dashboard and go straight to chat">
                skip → chat
              </Link>
            </div>
          </section>

          {/* C — recent library */}
          <RecentLibrary items={recent} />

          {/* D — top spaces */}
          <TopSpaces spaces={topSpaces} />

          {/* E — upcoming runs */}
          <UpcomingRuns rows={upcoming} />

          {/* F — inbox preview (omitted entirely if empty) */}
          <InboxPreview rows={inbox} />
        </main>
      </div>
    </div>
  );
}
