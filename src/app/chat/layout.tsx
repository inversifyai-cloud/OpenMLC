import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { TopRail } from "@/components/chat/TopRail";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import type { AvatarAccent } from "@/types/profile";

export const dynamic = "force-dynamic";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const [profile, conversations] = await Promise.all([
    db.profile.findUnique({
      where: { id: session.profileId },
      select: { displayName: true, username: true, avatarMonogram: true, avatarAccent: true },
    }),
    db.conversation.findMany({
      where: { profileId: session.profileId, archived: false },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, modelId: true, pinned: true, updatedAt: true },
    }),
  ]);

  if (!profile) redirect("/profiles");

  return (
    <div className="chat-app">
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
      {children}
    </div>
  );
}
