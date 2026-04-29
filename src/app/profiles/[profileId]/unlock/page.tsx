import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GlassPanel } from "@/components/chrome/GlassPanel";
import { HudLabel } from "@/components/chrome/HudLabel";
import { Wordmark } from "@/components/chrome/Brand";
import { ThemeToggle } from "@/components/chrome/ThemeToggle";
import { AvatarMonogram } from "@/components/chrome/AvatarMonogram";
import { UnlockForm } from "./form";
import type { AvatarAccent } from "@/types/profile";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, username: true, displayName: true, avatarMonogram: true, avatarAccent: true },
  });
  if (!profile) notFound();

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 h-12 border-b border-stroke-1">
        <Wordmark width={140} />
        <ThemeToggle />
      </header>
      <section className="flex-1 flex items-center justify-center p-8">
        <GlassPanel variant="strong" className="w-full max-w-sm p-8 rounded-r5 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <AvatarMonogram
              letters={profile.avatarMonogram}
              accent={profile.avatarAccent as AvatarAccent}
              size={56}
            />
            <div className="flex flex-col items-center gap-1">
              <HudLabel>welcome back</HudLabel>
              <span className="text-[20px] font-light tracking-tight">{profile.displayName}</span>
              <span className="font-mono text-[12px] text-fg-3">{profile.username}</span>
            </div>
          </div>
          <UnlockForm username={profile.username} />
        </GlassPanel>
      </section>
    </main>
  );
}
