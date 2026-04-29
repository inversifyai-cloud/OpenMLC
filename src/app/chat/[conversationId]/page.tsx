import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ChatThread } from "@/components/chat/ChatThread";
import type { AvatarAccent } from "@/types/profile";

export const dynamic = "force-dynamic";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const session = await getSession();
  if (!session.profileId) return notFound();

  const [conversation, profile] = await Promise.all([
    db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            modelId: true,
            reasoning: true,
            createdAt: true,
            attachments: { select: { id: true, filename: true, mimeType: true } },
          },
        },
      },
    }),
    db.profile.findUnique({
      where: { id: session.profileId },
      select: { avatarMonogram: true, avatarAccent: true, displayName: true },
    }),
  ]);

  if (!conversation || conversation.profileId !== session.profileId) return notFound();
  if (!profile) return notFound();

  return (
    <ChatThread
      conversationId={conversation.id}
      initialModelId={conversation.modelId}
      initialTitle={conversation.title}
      initialSystemPrompt={conversation.systemPrompt ?? ""}
      initialPersonaId={conversation.personaId ?? null}
      initialMessages={conversation.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        modelId: m.modelId,
        reasoning: m.reasoning,
        createdAt: m.createdAt.toISOString(),
        attachments: m.attachments,
      }))}
      profile={{
        avatarMonogram: profile.avatarMonogram,
        displayName: profile.displayName,
      }}
    />
  );
}
