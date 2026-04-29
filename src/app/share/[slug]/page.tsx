import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import "./share.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const share = await db.conversationShare.findUnique({
    where: { slug },
    include: { conversation: { select: { title: true } } },
  });
  if (!share) return { title: "Not found · openMLC" };
  return { title: `${share.conversation.title || "Shared conversation"} · openMLC` };
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params;

  const share = await db.conversationShare.findUnique({
    where: { slug },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: { id: true, role: true, content: true, modelId: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!share) notFound();

  if (share.expiresAt && new Date(share.expiresAt) < new Date()) notFound();

  await db.conversationShare.update({
    where: { slug },
    data: { viewCount: { increment: 1 } },
  });

  const conv = share.conversation;

  return (
    <div className="share-shell">
      <header className="share-header">
        <div className="share-brand">
          <span className="share-brand-dot" />
          <span className="share-brand-name">openmlc</span>
        </div>
        <div className="share-meta">
          <span className="share-chip">{conv.messages.length} messages</span>
          <span className="share-chip">{share.viewCount + 1} views</span>
        </div>
      </header>

      <main className="share-main">
        <h1 className="share-title">{conv.title || "Untitled Conversation"}</h1>

        <div className="share-thread">
          {conv.messages.map((msg) => (
            <div key={msg.id} className={`share-msg share-msg--${msg.role}`}>
              <div className="share-msg-avatar">
                {msg.role === "assistant" ? "ai" : msg.role === "user" ? "you" : "sys"}
              </div>
              <div className="share-msg-body">
                {msg.role === "assistant" && msg.modelId && (
                  <span className="share-msg-model">{msg.modelId}</span>
                )}
                <div className="share-msg-text">{msg.content}</div>
                <span className="share-msg-time">
                  {new Date(msg.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="share-footer">
        <span>shared via</span>
        <a href="/" className="share-footer-link">openmlc</a>
        <span>· read-only</span>
      </footer>
    </div>
  );
}
