/**
 * PATCH /api/conversations/[conversationId]/select-variant
 *
 * Body: { userMessageId: string; variantIndex: number }
 *
 * Updates `Conversation.selectedVariants` (JSON map of
 * {userMessageId: variantIndex}) atomically: read, parse, set, save.
 *
 * Used by the variant pager in MessageBubble to switch which assistant
 * reroll is displayed for a given user turn.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ conversationId: string }> };

const bodySchema = z.object({
  userMessageId: z.string().min(1),
  variantIndex: z.number().int().min(0),
});

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;

  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, profileId: true, selectedVariants: true },
  });
  if (!conv || conv.profileId !== session.profileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { userMessageId, variantIndex } = parsed.data;

  // Validate that the referenced user message belongs to this conversation.
  const userMsg = await db.message.findUnique({
    where: { id: userMessageId },
    select: { id: true, role: true, conversationId: true },
  });
  if (
    !userMsg ||
    userMsg.conversationId !== conversationId ||
    userMsg.role !== "user"
  ) {
    return NextResponse.json({ error: "invalid user message" }, { status: 400 });
  }

  // Validate that the variant exists for this parent.
  const variant = await db.message.findFirst({
    where: {
      parentUserMessageId: userMessageId,
      variantIndex,
      supersededAt: null,
    },
    select: { id: true },
  });
  if (!variant) {
    return NextResponse.json({ error: "variant not found" }, { status: 404 });
  }

  let map: Record<string, number> = {};
  try {
    const parsedMap = JSON.parse(conv.selectedVariants ?? "{}");
    if (parsedMap && typeof parsedMap === "object") {
      map = parsedMap as Record<string, number>;
    }
  } catch {
    map = {};
  }
  map[userMessageId] = variantIndex;

  await db.conversation.update({
    where: { id: conversationId },
    data: { selectedVariants: JSON.stringify(map) },
  });

  return NextResponse.json({ ok: true, selectedVariants: map });
}
