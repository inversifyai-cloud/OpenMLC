import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { SwarmConfigForm, type SwarmConfigInitial } from "@/components/swarm/SwarmConfigForm";

export const dynamic = "force-dynamic";

function parseProviders(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function normalizeEffort(s: string): "low" | "medium" | "high" {
  return s === "low" || s === "high" ? s : "medium";
}

export default async function SwarmSettingsPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const existing = await db.swarmConfig.findUnique({
    where: { profileId: session.profileId },
  });

  const initial: SwarmConfigInitial = existing
    ? {
        enabledProviders: parseProviders(existing.enabledProviders),
        minAgents: existing.minAgents,
        maxAgents: existing.maxAgents,
        reasoningEffort: normalizeEffort(existing.reasoningEffort),
        supervisorModel: existing.supervisorModel,
      }
    : {
        enabledProviders: [],
        minAgents: 2,
        maxAgents: 5,
        reasoningEffort: "medium",
        supervisorModel: "claude-sonnet-4-5",
      };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
          }}
        >
          settings · swarm
        </span>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 300,
            letterSpacing: "-0.02em",
            margin: "8px 0 4px",
            color: "var(--fg-1)",
          }}
        >
          agent swarm
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
          configure how the supervisor plans runs and which providers worker agents may use.
          changes apply to your next run.
        </p>
      </div>
      <SwarmConfigForm initial={initial} />
    </div>
  );
}
