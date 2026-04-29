import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChatIndexPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  // Jump to the most recent conversation, or create one if there are none.
  const latest = await db.conversation.findFirst({
    where: { profileId: session.profileId, archived: false },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: { id: true },
  });
  if (latest) redirect(`/chat/${latest.id}`);

  const fresh = await db.conversation.create({
    data: { profileId: session.profileId, modelId: "gpt-4o", title: "new conversation" },
    select: { id: true },
  });
  redirect(`/chat/${fresh.id}`);
}
