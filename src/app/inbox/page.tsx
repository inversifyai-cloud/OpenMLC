import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { TopRail } from "@/components/chat/TopRail";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatShell } from "@/components/chat/ChatShell";
import { InboxList, type InboxEntryDTO } from "@/components/inbox/InboxList";
import type { AvatarAccent } from "@/types/profile";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const [profile, conversations, entries, unreadCount] = await Promise.all([
    db.profile.findUnique({
      where: { id: session.profileId },
      select: { displayName: true, username: true, avatarMonogram: true, avatarAccent: true },
    }),
    db.conversation.findMany({
      where: { profileId: session.profileId, archived: false },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, modelId: true, pinned: true, updatedAt: true },
    }),
    db.inboxEntry.findMany({
      where: { profileId: session.profileId },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.inboxEntry.count({
      where: { profileId: session.profileId, read: false },
    }),
  ]);

  if (!profile) redirect("/profiles");

  const dto: InboxEntryDTO[] = entries.map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    summary: e.summary,
    refType: e.refType,
    refId: e.refId,
    read: e.read,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <ChatShell>
      <TopRail />
      <ChatSidebar
        initialConversations={conversations.map((c) => ({
          ...c,
          updatedAt: c.updatedAt.toISOString(),
        }))}
        profile={{
          displayName: profile.displayName,
          username: profile.username,
          avatarMonogram: profile.avatarMonogram,
          avatarAccent: profile.avatarAccent as AvatarAccent,
        }}
      />
      <main className="ibx-main">
        <div className="ibx-page">
          <header className="ibx-hero">
            <div className="ibx-hero__row">
              <div className="ibx-hero__title-block">
                <span className="ibx-hero__eyebrow">Async &middot; Activity</span>
                <h1 className="ibx-hero__title">Inbox</h1>
                <p className="ibx-hero__subtitle">
                  <em>
                    {unreadCount === 0
                      ? "all caught up"
                      : `${unreadCount} unread`}
                  </em>
                  {entries.length > 0 ? (
                    <>
                      <span className="ibx-hero__sep" aria-hidden>·</span>
                      <span className="ibx-hero__count">{entries.length} recent</span>
                    </>
                  ) : null}
                </p>
              </div>
              <InboxHeaderActions hasUnread={unreadCount > 0} />
            </div>
            <div className="ibx-hero__rule" aria-hidden />
          </header>
          <InboxList initialEntries={dto} />
        </div>
      </main>
    </ChatShell>
  );
}

// Tiny client island for the "mark all read" link — keeps the rest of the
// page a server component.
import { InboxMarkAllReadLink } from "@/components/inbox/InboxMarkAllReadLink";
function InboxHeaderActions({ hasUnread }: { hasUnread: boolean }) {
  return (
    <div className="ibx-hero__actions">
      <InboxMarkAllReadLink disabled={!hasUnread} />
    </div>
  );
}
