import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TopRail } from "@/components/chat/TopRail";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string }[] = [
  { href: "/settings/api-keys", label: "api keys" },
  { href: "/settings/knowledge", label: "knowledge" },
  { href: "/settings/swarm", label: "swarm" },
  { href: "/settings/mcp", label: "mcp servers" },
  { href: "/settings/sandbox", label: "code sandbox" },
  { href: "/settings/usage", label: "usage" },
  { href: "/settings/workflows", label: "workflows" },
  { href: "/settings/profile", label: "profile" },
];

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
      <div style={{ display: "flex", overflow: "hidden", minHeight: 0 }}>
        <aside
          className="sidebar"
          style={{ width: 240, minWidth: 240, padding: "20px 8px" }}
        >
          <div className="side-head">
            <span className="side-title"><b>settings</b></span>
          </div>
          <nav className="conv-list" style={{ paddingTop: 4 }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="conv">
                <span className="title" style={{ fontSize: 13 }}>{n.label}</span>
              </Link>
            ))}
            <Link href="/chat" className="conv" style={{ marginTop: 12 }}>
              <span
                className="meta"
                style={{
                  color: "var(--fg-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                }}
              >
                ← back to chat
              </span>
            </Link>
          </nav>
        </aside>
        <main style={{ flex: 1, overflow: "auto", padding: "32px 40px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
