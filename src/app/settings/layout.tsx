import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TopRail } from "@/components/chat/TopRail";
import { SettingsNav } from "@/components/settings/SettingsNav";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "44px 1fr",
        height: "100vh",
        position: "relative",
        isolation: "isolate",
      }}
    >
      <TopRail />
      <div className="settings-shell">
        <aside className="settings-rail">
          <SettingsNav />
        </aside>
        <main className="settings-main">
          <div className="settings-main__inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
