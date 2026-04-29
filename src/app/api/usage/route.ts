import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type GroupBy = "provider" | "model" | "day";
type Range = "24h" | "7d" | "30d";

function rangeToStartDay(range: Range): string {
  const now = new Date();
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
  now.setDate(now.getDate() - days);
  return now.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "30d") as Range;
  const groupBy = (url.searchParams.get("groupBy") ?? "day") as GroupBy;

  if (!["24h", "7d", "30d"].includes(range)) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }
  if (!["provider", "model", "day"].includes(groupBy)) {
    return NextResponse.json({ error: "invalid groupBy" }, { status: 400 });
  }

  const startDay = rangeToStartDay(range);

  const rows = await db.usageDaily.findMany({
    where: { profileId, day: { gte: startDay } },
    orderBy: { day: "asc" },
  });

  // Aggregate in-memory by the requested dimension
  const agg = new Map<
    string,
    { inputTokens: number; outputTokens: number; costUsd: number; requestCount: number; label: string }
  >();

  for (const row of rows) {
    const key =
      groupBy === "provider" ? row.providerId
      : groupBy === "model"  ? row.modelId
      : row.day;

    const existing = agg.get(key);
    if (existing) {
      existing.inputTokens  += row.inputTokens;
      existing.outputTokens += row.outputTokens;
      existing.costUsd      += row.costUsd;
      existing.requestCount += row.requestCount;
    } else {
      agg.set(key, {
        label: key,
        inputTokens:  row.inputTokens,
        outputTokens: row.outputTokens,
        costUsd:      row.costUsd,
        requestCount: row.requestCount,
      });
    }
  }

  const data = Array.from(agg.values()).sort((a, b) => b.costUsd - a.costUsd);

  return NextResponse.json({ range, groupBy, data });
}
