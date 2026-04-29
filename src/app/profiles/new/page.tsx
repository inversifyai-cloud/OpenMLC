import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { profileCount } from "@/lib/profiles";
import { GlassPanel } from "@/components/chrome/GlassPanel";
import { HudLabel } from "@/components/chrome/HudLabel";
import { Wordmark } from "@/components/chrome/Brand";
import { ThemeToggle } from "@/components/chrome/ThemeToggle";
import { NewProfileForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewProfilePage() {
  const [settings, count] = await Promise.all([getSettings(), profileCount()]);
  if (settings.profileCreationLocked && count > 0) redirect("/profiles");

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 h-12 border-b border-stroke-1">
        <Wordmark width={140} />
        <ThemeToggle />
      </header>
      <section className="flex-1 flex items-center justify-center p-8">
        <GlassPanel variant="strong" className="w-full max-w-md p-8 rounded-r5 flex flex-col gap-6">
          <div>
            <HudLabel>new profile</HudLabel>
            <h1 className="text-[28px] font-light tracking-tight mt-2">create profile</h1>
            <p className="text-fg-3 text-[14px] mt-2">
              {count === 0 ? "the first profile becomes the operator. all profiles are equal-privilege." : "all profiles are equal-privilege."}
            </p>
          </div>
          <NewProfileForm />
        </GlassPanel>
      </section>
    </main>
  );
}
