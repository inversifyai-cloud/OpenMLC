import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const caps = await db.budgetCap.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ caps });
}

const createSchema = z.object({
  providerId:  z.string().min(1),
  capUsd:      z.number().positive(),
  periodDays:  z.number().int().min(1).max(365).default(30),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const cap = await db.budgetCap.upsert({
    where: { profileId_providerId: { profileId, providerId: parsed.data.providerId } },
    create: { profileId, ...parsed.data },
    update: { capUsd: parsed.data.capUsd, periodDays: parsed.data.periodDays },
  });

  return NextResponse.json({ cap }, { status: 201 });
}
