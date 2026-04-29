import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TopRail } from "@/components/chat/TopRail";
import { SwarmRunResumeClient } from "./SwarmRunResumeClient";

export const dynamic = "force-dynamic";

export default async function SwarmRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
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
      <div style={{ overflow: "auto", minHeight: 0 }}>
        <SwarmRunResumeClient runId={runId} />
      </div>
    </div>
  );
}
