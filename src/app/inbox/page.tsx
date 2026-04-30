import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/chrome/AppShell";
import { InboxList, type InboxEntryDTO } from "@/components/inbox/InboxList";
import { InboxMarkAllReadLink } from "@/components/inbox/InboxMarkAllReadLink";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const [entries, unreadCount] = await Promise.all([
    db.inboxEntry.findMany({
      where: { profileId: session.profileId },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.inboxEntry.count({
      where: { profileId: session.profileId, read: false },
    }),
  ]);

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

  const subtitle =
    unreadCount === 0
      ? `all caught up · ${entries.length} recent`
      : `${unreadCount} unread · ${entries.length} recent`;

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader
        kicker="async · activity"
        title="inbox"
        subtitle={subtitle}
        right={<InboxMarkAllReadLink disabled={unreadCount === 0} />}
      />
      <InboxList initialEntries={dto} />
    </div>
  );
}
