import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { KnowledgeManager, type KnowledgeFileRow } from "@/components/knowledge/KnowledgeManager";

export const dynamic = "force-dynamic";

export default async function KnowledgeSettingsPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const rows = await db.knowledgeFile.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });

  const initialFiles: KnowledgeFileRow[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mimeType,
    size: r.size,
    active: r.active,
    embeddingStatus: r.embeddingStatus as KnowledgeFileRow["embeddingStatus"],
    createdAt: r.createdAt.toISOString(),
    chunkCount: r._count.chunks,
  }));

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 28 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
          }}
        >
          settings · knowledge
        </span>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 300,
            letterSpacing: "-0.02em",
            margin: "8px 0 4px",
            color: "var(--fg-1)",
          }}
        >
          knowledge base
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
          drop in documents and the assistant retrieves the most relevant passages at chat time.
          embeddings live in your local db; nothing leaves your machine except the embed call to
          your selected provider.
        </p>
      </div>
      <KnowledgeManager initialFiles={initialFiles} />
    </div>
  );
}
