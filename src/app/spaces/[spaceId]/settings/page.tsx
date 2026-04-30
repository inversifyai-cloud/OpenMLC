import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { SpaceSettingsForm } from "@/components/spaces/SpaceSettingsForm";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ spaceId: string }> };

export default async function SpaceSettingsPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");
  const { spaceId } = await params;

  const space = await db.space.findUnique({ where: { id: spaceId } });
  if (!space || space.profileId !== session.profileId) notFound();

  const personas = await db.persona.findMany({
    where: { profileId: session.profileId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, emoji: true },
  });

  return (
    <main className="spc-shell">
      <div className="spc-hero">
        <div className="spc-hero-text">
          <span className="spc-eyebrow">
            Fig. 02.{space.id.slice(-4)} — Settings
          </span>
          <h1 className="spc-title">
            {space.emoji ? `${space.emoji} ` : ""}{space.name}
          </h1>
          <p className="spc-sub">
            Edit identity, system prompt, and defaults for new chats opened in this space.
          </p>
        </div>
        <div className="spc-actions">
          <Link href={`/spaces/${space.id}`} className="spc-btn spc-btn--ghost">← back</Link>
        </div>
      </div>
      <SpaceSettingsForm
        space={{
          id: space.id,
          name: space.name,
          emoji: space.emoji,
          description: space.description,
          systemPrompt: space.systemPrompt,
          defaultPersonaId: space.defaultPersonaId,
          defaultModel: space.defaultModel,
          archived: space.archived,
        }}
        personas={personas}
      />
    </main>
  );
}
