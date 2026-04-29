import Link from "next/link";
import { listProfiles } from "@/lib/profiles";
import { getSettings } from "@/lib/settings";
import { GlassPanel } from "@/components/chrome/GlassPanel";
import { HudLabel } from "@/components/chrome/HudLabel";
import { LiveDot } from "@/components/chrome/LiveDot";
import { AvatarMonogram } from "@/components/chrome/AvatarMonogram";
import { Wordmark } from "@/components/chrome/Brand";
import { ThemeToggle } from "@/components/chrome/ThemeToggle";
import type { AvatarAccent } from "@/types/profile";

export const dynamic = "force-dynamic";

export default async function ProfilesIndexPage() {
  const [profiles, settings] = await Promise.all([listProfiles(), getSettings()]);
  const noProfiles = profiles.length === 0;
  const canCreate = !settings.profileCreationLocked || noProfiles;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 h-12 border-b border-stroke-1">
        <Wordmark width={140} />
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <LiveDot status="ok" />
            <HudLabel>idle</HudLabel>
          </span>
          <ThemeToggle />
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center p-8">
        <GlassPanel
          variant="strong"
          className="w-full max-w-md p-8 rounded-r5 flex flex-col gap-6"
        >
          <div>
            <HudLabel>profile</HudLabel>
            <h1 className="text-[28px] font-light tracking-tight mt-2">
              {noProfiles ? "first run" : "pick a profile"}
            </h1>
            <p className="text-fg-3 text-[14px] mt-2">
              {noProfiles
                ? "create the first profile to get started. your keys stay on this machine."
                : "your keys, your models, your machine."}
            </p>
          </div>

          {profiles.length > 0 && (
            <ul className="flex flex-col gap-2">
              {profiles.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/profiles/${p.id}/unlock`}
                    className="flex items-center gap-3 p-3 rounded-r3 hover:bg-surface-hover transition-colors"
                    style={{ transitionDuration: "var(--dur-1)" }}
                  >
                    <AvatarMonogram
                      letters={p.avatarMonogram}
                      accent={p.avatarAccent as AvatarAccent}
                      size={36}
                    />
                    <span className="flex flex-col items-start">
                      <span className="text-fg-1 text-[15px]">{p.displayName}</span>
                      <span className="font-mono text-fg-3 text-[12px]">{p.username}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {canCreate ? (
            <Link
              href="/profiles/new"
              className="inline-flex items-center justify-center h-10 rounded-r3 bg-fg-1 text-fg-inverse text-[14px] font-medium lowercase hover:brightness-110 transition-all"
              style={{ transitionDuration: "var(--dur-1)" }}
            >
              {noProfiles ? "create first profile" : "new profile"}
            </Link>
          ) : (
            <p className="text-fg-3 text-[12px] font-mono uppercase tracking-[0.12em]">
              · profile creation locked
            </p>
          )}
        </GlassPanel>
      </section>
    </main>
  );
}
