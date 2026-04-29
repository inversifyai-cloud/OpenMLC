import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  const runs = await db.workflowRun.findMany({
    where: { profileId: session.profileId },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      schedule: { select: { id: true, name: true } },
      webhook: { select: { id: true, slug: true } },
    },
  });

  return NextResponse.json({ runs });
}
