import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getDefaultModel } from "@/lib/providers/registry";
import { findModel } from "@/lib/providers/catalog";

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conversations = await db.conversation.findMany({
    where: { profileId: session.profileId, archived: false },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      modelId: true,
      pinned: true,
      archived: true,
      folderId: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ conversations });
}

const createSchema = z.object({
  modelId: z.string().min(1).optional(),
  personaId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {

  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  let personaId: string | null = null;
  let personaModelId: string | null = null;
  if (parsed.data.personaId) {
    const persona = await db.persona.findUnique({
      where: { id: parsed.data.personaId },
      select: { id: true, profileId: true, defaultModel: true },
    });
    if (persona && persona.profileId === session.profileId) {
      personaId = persona.id;
      personaModelId = persona.defaultModel ?? null;
    }
  }
  if (!personaId) {
    const defaultPersona = await db.persona.findFirst({
      where: { profileId: session.profileId, isDefault: true },
      select: { id: true, defaultModel: true },
    });
    if (defaultPersona) {
      personaId = defaultPersona.id;
      personaModelId = defaultPersona.defaultModel ?? null;
    }
  }

  const requestedModelId = parsed.data.modelId ?? personaModelId ?? null;
  const modelId = requestedModelId
    ? ((await findModel(requestedModelId)) ? requestedModelId : getDefaultModel().id)
    : getDefaultModel().id;

  const conversation = await db.conversation.create({
    data: {
      profileId: session.profileId,
      modelId,
      title: "new conversation",
      personaId,
    },
    select: { id: true, title: true, modelId: true, pinned: true, archived: true, folderId: true, updatedAt: true, personaId: true },
  });
  return NextResponse.json({ conversation });
}
