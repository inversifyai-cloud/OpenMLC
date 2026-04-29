import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  body: z.string().min(1).max(4000),
  emoji: z.string().max(8).optional().nullable(),
  shortcut: z.string().max(40).optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const templates = await db.promptTemplate.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  const template = await db.promptTemplate.create({
    data: { ...parsed.data, profileId: session.profileId },
  });
  return NextResponse.json({ template }, { status: 201 });
}
