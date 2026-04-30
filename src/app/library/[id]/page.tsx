import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { LibraryDetailRenderer } from "@/components/library/LibraryDetailRenderer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function parseId(raw: string): { kind: "artifact" | "research" | "browser"; id: string } | null {
  const decoded = decodeURIComponent(raw);
  const idx = decoded.indexOf(":");
  if (idx <= 0) return null;
  const kind = decoded.slice(0, idx);
  const id = decoded.slice(idx + 1);
  if (!id) return null;
  if (kind !== "artifact" && kind !== "research" && kind !== "browser") return null;
  return { kind, id };
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "moments ago";
  if (diff < hr) return `${Math.floor(diff / min)} minutes ago`;
  if (diff < day) return `${Math.floor(diff / hr)} hours ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default async function LibraryDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const { id: rawId } = await params;
  const parsed = parseId(rawId);
  if (!parsed) notFound();

  const profileId = session.profileId;

  if (parsed.kind === "artifact") {
    const a = await db.artifact.findFirst({
      where: { id: parsed.id, conversation: { profileId } },
      select: {
        id: true,
        title: true,
        type: true,
        language: true,
        content: true,
        version: true,
        createdAt: true,
        messageId: true,
        conversationId: true,
        conversation: { select: { id: true, title: true } },
      },
    });
    if (!a) notFound();

    return (
      <DetailLayout
        kicker={`Figure · ${a.type}${a.language ? ` · ${a.language}` : ""}`}
        title={a.title || "untitled artifact"}
        meta={[
          { label: "captured", value: relTime(a.createdAt.toISOString()) },
          { label: "version", value: `v${a.version}` },
          { label: "words", value: String(wordCount(a.content)) },
          {
            label: "from",
            value: a.conversation.title || "conversation",
            href: `/chat/${a.conversation.id}`,
          },
        ]}
      >
        <LibraryDetailRenderer
          kind="artifact"
          payload={{
            id: a.id,
            title: a.title,
            type: a.type as
              | "html"
              | "svg"
              | "code"
              | "markdown"
              | "react"
              | "mermaid"
              | "chart"
              | "research",
            language: a.language,
            content: a.content,
            version: a.version,
            createdAt: a.createdAt.toISOString(),
            messageId: a.messageId,
            conversationId: a.conversationId,
          }}
        />
      </DetailLayout>
    );
  }

  if (parsed.kind === "research") {
    const r = await db.researchSession.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        query: true,
        plan: true,
        status: true,
        sources: true,
        notes: true,
        createdAt: true,
        completedAt: true,
        conversationId: true,
        messageId: true,
      },
    });
    if (!r) notFound();
    const convo = await db.conversation.findUnique({
      where: { id: r.conversationId },
      select: { id: true, title: true, profileId: true },
    });
    if (!convo || convo.profileId !== profileId) notFound();

    let answerContent = "";
    if (r.messageId) {
      const sourceArtifact = await db.artifact.findFirst({
        where: {
          messageId: r.messageId,
          type: "research",
        },
        select: { content: true },
      });
      if (sourceArtifact) answerContent = sourceArtifact.content;
    }
    if (!answerContent) {
      try {
        const parsedSources = JSON.parse(r.sources);
        answerContent = JSON.stringify(
          { answer: r.plan ?? "", sources: parsedSources },
          null,
          2,
        );
      } catch {
        answerContent = JSON.stringify({ answer: r.plan ?? "", sources: [] });
      }
    }

    let sourceCount = 0;
    try {
      const parsedSources = JSON.parse(r.sources);
      if (Array.isArray(parsedSources)) sourceCount = parsedSources.length;
    } catch {}

    return (
      <DetailLayout
        kicker={`Research · ${r.status}`}
        title={r.query}
        meta={[
          { label: "captured", value: relTime(r.createdAt.toISOString()) },
          { label: "sources", value: String(sourceCount) },
          {
            label: "completed",
            value: r.completedAt ? relTime(r.completedAt.toISOString()) : "—",
          },
          {
            label: "from",
            value: convo.title || "conversation",
            href: `/chat/${convo.id}`,
          },
        ]}
      >
        <LibraryDetailRenderer
          kind="research"
          payload={{
            id: r.id,
            title: r.query,
            type: "research",
            language: null,
            content: answerContent,
            version: 1,
            createdAt: r.createdAt.toISOString(),
            messageId: r.messageId ?? "",
            conversationId: r.conversationId,
          }}
        />
      </DetailLayout>
    );
  }

  // browser
  const b = await db.browserSession.findFirst({
    where: { id: parsed.id, profileId },
    select: {
      id: true,
      startUrl: true,
      status: true,
      steps: true,
      lastScreenshot: true,
      createdAt: true,
      closedAt: true,
      conversationId: true,
    },
  });
  if (!b) notFound();

  let convoTitle: string | null = null;
  if (b.conversationId) {
    const c = await db.conversation.findUnique({
      where: { id: b.conversationId },
      select: { title: true },
    });
    convoTitle = c?.title ?? null;
  }

  return (
    <DetailLayout
      kicker={`Browser session · ${b.status}`}
      title={b.startUrl ?? "browser session"}
      meta={[
        { label: "captured", value: relTime(b.createdAt.toISOString()) },
        { label: "steps", value: String(b.steps) },
        {
          label: "closed",
          value: b.closedAt ? relTime(b.closedAt.toISOString()) : "—",
        },
        b.conversationId
          ? {
              label: "from",
              value: convoTitle || "conversation",
              href: `/chat/${b.conversationId}`,
            }
          : { label: "from", value: "—" },
      ]}
    >
      <LibraryDetailRenderer
        kind="browser"
        browser={{
          id: b.id,
          startUrl: b.startUrl,
          status: b.status,
          steps: b.steps,
          lastScreenshot: b.lastScreenshot,
          createdAt: b.createdAt.toISOString(),
          closedAt: b.closedAt ? b.closedAt.toISOString() : null,
        }}
      />
    </DetailLayout>
  );
}

function DetailLayout({
  kicker,
  title,
  meta,
  children,
}: {
  kicker: string;
  title: string;
  meta: { label: string; value: string; href?: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="lib-detail">
      <div className="lib-detail__crumb">
        <Link href="/library" className="lib-detail__back">
          ← Library
        </Link>
      </div>

      <header className="lib-detail__header">
        <span className="lib-detail__kicker">{kicker}</span>
        <h1 className="lib-detail__title">{title}</h1>
        <dl className="lib-detail__meta">
          {meta.map((m) => (
            <div key={m.label} className="lib-detail__meta-row">
              <dt>{m.label}</dt>
              <dd>
                {m.href ? (
                  <Link href={m.href} className="lib-detail__link">
                    {m.value}
                  </Link>
                ) : (
                  m.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <hr className="lib-detail__rule" />

      <section className="lib-detail__body">{children}</section>
    </div>
  );
}
