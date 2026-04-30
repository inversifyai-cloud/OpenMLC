import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { NewConversationInSpace } from "@/components/spaces/NewConversationInSpace";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ spaceId: string }> };

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function SpaceDetailPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");
  const { spaceId } = await params;

  const space = await db.space.findUnique({
    where: { id: spaceId },
    include: {
      conversations: {
        where: { archived: false },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: 50,
        select: { id: true, title: true, modelId: true, updatedAt: true, pinned: true },
      },
      knowledgeFiles: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          filename: true,
          embeddingStatus: true,
          size: true,
          createdAt: true,
          _count: { select: { chunks: true } },
        },
      },
      memories: {
        where: { active: true },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 50,
        select: { id: true, text: true, pinned: true, createdAt: true },
      },
    },
  });

  if (!space || space.profileId !== session.profileId) {
    notFound();
  }

  return (
    <main className="spc-shell">
      <div className="spc-detail-head">
        <span className="spc-detail-emoji" aria-hidden>{space.emoji || "◇"}</span>
        <div className="spc-detail-text">
          <span className="spc-eyebrow">
            Fig. 02.{space.id.slice(-4)} — {fmtDate(space.createdAt)}
          </span>
          <h1 className="spc-detail-name">{space.name}</h1>
          {space.description && (
            <p className="spc-detail-desc">{space.description}</p>
          )}
        </div>
        <div className="spc-actions">
          <Link href="/spaces" className="spc-btn spc-btn--ghost">← all spaces</Link>
          <Link href={`/spaces/${space.id}/settings`} className="spc-btn">
            settings
          </Link>
        </div>
      </div>

      <section className="spc-section">
        <header className="spc-section-head">
          <span className="spc-section-label"><i>Conversations</i></span>
          <span className="spc-section-meta">{space.conversations.length} item{space.conversations.length === 1 ? "" : "s"}</span>
        </header>
        <div>
          <NewConversationInSpace spaceId={space.id} />
        </div>
        <div className="spc-list">
          {space.conversations.length === 0 ? (
            <div className="spc-list-empty">no chats in this space yet — start one above.</div>
          ) : (
            space.conversations.map((c) => (
              <Link key={c.id} className="spc-list-row" href={`/chat/${c.id}`} prefetch>
                <span className="title">
                  {c.pinned ? "★ " : ""}{c.title || "untitled"}
                </span>
                <span className="meta">
                  {c.modelId} · {fmtDate(c.updatedAt)}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="spc-section">
        <header className="spc-section-head">
          <span className="spc-section-label"><i>Knowledge</i></span>
          <span className="spc-section-meta">
            {space.knowledgeFiles.length} file{space.knowledgeFiles.length === 1 ? "" : "s"} ·{" "}
            <Link href="/settings/knowledge" style={{ color: "var(--fg-3)", textDecoration: "underline" }}>
              all files
            </Link>
          </span>
        </header>
        <div className="spc-list">
          {space.knowledgeFiles.length === 0 ? (
            <div className="spc-list-empty">
              no files scoped to this space. Upload from{" "}
              <Link href="/settings/knowledge" style={{ color: "var(--fg-accent)" }}>
                Settings → Knowledge
              </Link>{" "}
              and assign them here. Root-level files remain available.
            </div>
          ) : (
            space.knowledgeFiles.map((f) => (
              <div key={f.id} className="spc-list-row">
                <span className="title">{f.filename}</span>
                <span className="meta">
                  {f._count.chunks} chunk{f._count.chunks === 1 ? "" : "s"} · {f.embeddingStatus}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="spc-section">
        <header className="spc-section-head">
          <span className="spc-section-label"><i>Memory</i></span>
          <span className="spc-section-meta">{space.memories.length} fact{space.memories.length === 1 ? "" : "s"}</span>
        </header>
        <div className="spc-list">
          {space.memories.length === 0 ? (
            <div className="spc-list-empty">no space-scoped memories yet — auto-extracted during chat.</div>
          ) : (
            space.memories.map((m) => (
              <div key={m.id} className="spc-list-row">
                <span className="title">{m.pinned ? "★ " : ""}{m.text}</span>
                <span className="meta">{fmtDate(m.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
