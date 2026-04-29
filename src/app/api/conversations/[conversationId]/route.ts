import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { findModel } from "@/lib/providers/catalog";

type RouteCtx = { params: Promise<{ conversationId: string }> };

async function authOwn(conversationId: string) {
  const session = await getSession();
  if (!session.profileId) return { error: "unauthorized" as const, status: 401, profileId: null };
  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, profileId: true },
  });
  if (!conv || conv.profileId !== session.profileId) {
    return { error: "not_found" as const, status: 404, profileId: null };
  }
  return { error: null, status: 200, profileId: session.profileId };
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;
  const auth = await authOwn(conversationId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          modelId: true,
          reasoning: true,
          createdAt: true,
        },
      },
    },
  });
  return NextResponse.json({ conversation });
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  modelId: z.string().min(1).optional(),
  systemPrompt: z.string().max(8000).nullable().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;
  const auth = await authOwn(conversationId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  const data = parsed.data;
  if (data.modelId && !(await findModel(data.modelId))) {
    return NextResponse.json({ error: "unknown model" }, { status: 400 });
  }

  const conversation = await db.conversation.update({
    where: { id: conversationId },
    data,
    select: { id: true, title: true, modelId: true, pinned: true, archived: true, folderId: true, updatedAt: true },
  });
  return NextResponse.json({ conversation });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;
  const auth = await authOwn(conversationId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await db.conversation.delete({ where: { id: conversationId } });
  return NextResponse.json({ ok: true });
}
