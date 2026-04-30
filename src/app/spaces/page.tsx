import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/chrome/AppShell";
import { SpacesGrid, type SpaceCard } from "@/components/spaces/SpacesGrid";

export const dynamic = "force-dynamic";

export default async function SpacesIndexPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const rows = await db.space.findMany({
    where: { profileId: session.profileId, archived: false },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { conversations: true, knowledgeFiles: true, memories: true } },
    },
  });

  const initialSpaces: SpaceCard[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    description: r.description ?? null,
    chatCount: r._count.conversations,
    fileCount: r._count.knowledgeFiles,
    memoryCount: r._count.memories,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        kicker="workspaces"
        title="spaces"
        subtitle="group conversations, knowledge, and memory by project"
      />
      <SpacesGrid initialSpaces={initialSpaces} />
    </div>
  );
}
