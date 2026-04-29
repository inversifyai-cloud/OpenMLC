import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  emoji: z.string().max(8).optional().nullable(),
  systemPrompt: z.string().min(1).max(4000),
  description: z.string().max(280).optional().nullable(),
  defaultModel: z.string().max(80).optional().nullable(),
  toolsEnabled: z.array(z.string()).optional(),
  isDefault: z.boolean().optional().default(false),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const personas = await db.persona.findMany({
    where: { profileId: session.profileId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ personas });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { toolsEnabled, ...rest } = parsed.data;

  if (rest.isDefault) {
    await db.persona.updateMany({
      where: { profileId: session.profileId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const persona = await db.persona.create({
    data: {
      ...rest,
      profileId: session.profileId,
      toolsEnabled: toolsEnabled ? JSON.stringify(toolsEnabled) : null,
    },
  });
  return NextResponse.json({ persona }, { status: 201 });
}
