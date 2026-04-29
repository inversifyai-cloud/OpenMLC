import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { TopRail } from "@/components/chat/TopRail";
import { HudLabel } from "@/components/chrome/HudLabel";
import { SwarmHomeClient } from "./SwarmHomeClient";

export const dynamic = "force-dynamic";

export default async function SwarmPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const settings = await getSettings();

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
      <div style={{ overflow: "hidden", minHeight: 0 }}>
        {settings.swarmEnabled ? (
          <SwarmHomeClient />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
            }}
          >
            <div
              className="glass"
              style={{
                padding: "32px 40px",
                borderRadius: "var(--r-3)",
                maxWidth: 480,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <HudLabel>swarm</HudLabel>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 300,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  color: "var(--fg-1)",
                }}
              >
                swarm disabled by operator
              </h2>
              <p style={{ color: "var(--fg-3)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                this server has the agent swarm turned off. ask whoever runs this instance to
                enable it in operator settings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
