import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AvatarMonogram } from "@/components/chrome/AvatarMonogram";
import { StartScreenToggle } from "@/components/home/StartScreenToggle";
import type { AvatarAccent } from "@/types/profile";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const profile = await db.profile.findUnique({
    where: { id: session.profileId },
    select: {
      displayName: true,
      username: true,
      avatarMonogram: true,
      avatarAccent: true,
      createdAt: true,
      startScreen: true,
    },
  });
  if (!profile) redirect("/profiles");

  const startScreen: "home" | "chat" =
    profile.startScreen === "chat" ? "chat" : "home";

  return (
    <div style={{ maxWidth: 720 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-3)",
        }}
      >
        settings · profile
      </span>
      <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", margin: "8px 0 24px", color: "var(--fg-1)" }}>
        profile
      </h1>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: 20, borderRadius: 12,
          border: "1px solid var(--stroke-1)", background: "var(--surface-1)",
        }}
      >
        <AvatarMonogram letters={profile.avatarMonogram} accent={profile.avatarAccent as AvatarAccent} size={56} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: "var(--fg-1)" }}>{profile.displayName}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)" }}>
            {profile.username} · joined {profile.createdAt.toLocaleDateString()}
          </div>
        </div>
      </div>
      <p style={{ marginTop: 16, color: "var(--fg-3)", fontSize: 13 }}>
        password reset is operator-only via the cli:{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>npm run openmlc -- reset-password {profile.username}</code>
      </p>

      <StartScreenToggle initial={startScreen} />
    </div>
  );
}
