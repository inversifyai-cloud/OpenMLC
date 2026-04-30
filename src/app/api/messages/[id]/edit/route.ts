import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  content: z.string().min(1).max(200000),
});

/**
 * POST /api/messages/[id]/edit
 *
 * Inline-edits a user message. Validates ownership, updates the message
 * content, and marks every later message in the same conversation as
 * superseded so the client can truncate and re-stream.
 *
 * Returns: { conversationId, truncatedMessageIds }
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;

  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

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
  const { content } = parsed.data;

  const message = await db.message.findUnique({
    where: { id },
    include: { conversation: { select: { id: true, profileId: true } } },
  });
  if (!message || !message.conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (message.conversation.profileId !== profileId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (message.role !== "user") {
    return NextResponse.json({ error: "only user messages are editable" }, { status: 400 });
  }

  // Already-superseded messages cannot be edited (they're historical).
  if (message.supersededAt) {
    return NextResponse.json({ error: "message is superseded" }, { status: 409 });
  }

  const conversationId = message.conversationId;
  const cutoff = message.createdAt;

  const result = await db.$transaction(async (tx) => {
    await tx.message.update({
      where: { id },
      data: { content },
    });

    const later = await tx.message.findMany({
      where: {
        conversationId,
        createdAt: { gt: cutoff },
        supersededAt: null,
      },
      select: { id: true },
    });

    if (later.length > 0) {
      await tx.message.updateMany({
        where: {
          id: { in: later.map((m) => m.id) },
        },
        data: { supersededAt: new Date() },
      });
    }

    return { truncatedMessageIds: later.map((m) => m.id) };
  });

  return NextResponse.json({
    conversationId,
    truncatedMessageIds: result.truncatedMessageIds,
  });
}
