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
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    // empty body is fine
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  const modelId = parsed.data.modelId
    ? ((await findModel(parsed.data.modelId)) ? parsed.data.modelId : getDefaultModel().id)
    : getDefaultModel().id;

  const conversation = await db.conversation.create({
    data: {
      profileId: session.profileId,
      modelId,
      title: "new conversation",
    },
    select: { id: true, title: true, modelId: true, pinned: true, archived: true, folderId: true, updatedAt: true },
  });
  return NextResponse.json({ conversation });
}
