import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ChatThread } from "@/components/chat/ChatThread";

export const dynamic = "force-dynamic";

export default async function ChatConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams?: Promise<{ msg?: string }>;
}) {
  const { conversationId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  // search-flash: lets /search?msg=… deep-link into a specific message
  const flashMessageId = typeof sp?.msg === "string" ? sp.msg : null;
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
            supersededAt: true,
            attachments: { select: { id: true, filename: true, mimeType: true } },
            // reroll-feature: variant pager fields
            parentUserMessageId: true,
            variantIndex: true,
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

  // edit-feature: split active vs superseded so client can offer a "show" toggle
  const allMessages = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    modelId: m.modelId,
    reasoning: m.reasoning,
    createdAt: m.createdAt.toISOString(),
    supersededAt: m.supersededAt ? m.supersededAt.toISOString() : null,
    attachments: m.attachments,
    // reroll-feature: variant fields
    parentUserMessageId: m.parentUserMessageId ?? null,
    variantIndex: m.variantIndex ?? 0,
  }));

  const initialMessages = allMessages.filter((m) => !m.supersededAt);
  const supersededMessages = allMessages.filter((m) => !!m.supersededAt);

  return (
    <ChatThread
      conversationId={conversation.id}
      initialModelId={conversation.modelId}
      initialTitle={conversation.title}
      initialSystemPrompt={conversation.systemPrompt ?? ""}
      initialPersonaId={conversation.personaId ?? null}
      initialMessages={initialMessages}
      supersededMessages={supersededMessages}
      /* reroll-feature: pass selected-variants map for the pager */
      initialSelectedVariants={conversation.selectedVariants ?? "{}"}
      profile={{
        avatarMonogram: profile.avatarMonogram,
        displayName: profile.displayName,
      }}
      /* search-flash: scrolls + pulses on mount when present */
      flashMessageId={flashMessageId}
    />
  );
}
