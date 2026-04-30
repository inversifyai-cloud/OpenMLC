import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  emoji: z.string().max(8).optional().nullable(),
  description: z.string().max(280).optional().nullable(),
  systemPrompt: z.string().max(8000).optional().nullable(),
  defaultPersonaId: z.string().min(1).optional().nullable(),
  defaultModel: z.string().max(80).optional().nullable(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const light = url.searchParams.get("light") === "1";
  const includeArchived = url.searchParams.get("archived") === "1";

  const where = { profileId: session.profileId, ...(includeArchived ? {} : { archived: false }) };

  if (light) {
    const spaces = await db.space.findMany({
      where,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, emoji: true, archived: true },
    });
    return NextResponse.json({ spaces });
  }

  const spaces = await db.space.findMany({
    where,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
      archived: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { conversations: true, knowledgeFiles: true, memories: true } },
    },
  });

  const shaped = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    description: s.description ?? null,
    archived: s.archived,
    updatedAt: s.updatedAt,
    createdAt: s.createdAt,
    chatCount: s._count.conversations,
    fileCount: s._count.knowledgeFiles,
    memoryCount: s._count.memories,
  }));
  return NextResponse.json({ spaces: shaped });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.defaultPersonaId) {
    const persona = await db.persona.findUnique({
      where: { id: parsed.data.defaultPersonaId },
      select: { profileId: true },
    });
    if (!persona || persona.profileId !== session.profileId) {
      return NextResponse.json({ error: "unknown persona" }, { status: 400 });
    }
  }

  const last = await db.space.findFirst({
    where: { profileId: session.profileId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const space = await db.space.create({
    data: {
      profileId: session.profileId,
      name: parsed.data.name.trim(),
      emoji: parsed.data.emoji?.trim() || null,
      description: parsed.data.description ?? null,
      systemPrompt: parsed.data.systemPrompt ?? null,
      defaultPersonaId: parsed.data.defaultPersonaId ?? null,
      defaultModel: parsed.data.defaultModel ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
  return NextResponse.json({ space }, { status: 201 });
}
