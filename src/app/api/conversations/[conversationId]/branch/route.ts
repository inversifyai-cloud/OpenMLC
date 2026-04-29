import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ conversationId: string }> };

const bodySchema = z.object({
  messageId: z.string().min(1),
});

export async function POST(req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profileId = session.profileId;

  // Verify ownership
  const source = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, modelId: true, reasoning: true, createdAt: true },
      },
    },
  });
  if (!source || source.profileId !== profileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  const { messageId } = parsed.data;

  // Slice messages up to and including the pivot message
  const pivotIdx = source.messages.findIndex((m) => m.id === messageId);
  if (pivotIdx === -1) return NextResponse.json({ error: "message not found" }, { status: 404 });
  const messagesToCopy = source.messages.slice(0, pivotIdx + 1);

  // Build branch title
  const branchTitle = `${(source.title ?? "untitled").slice(0, 60)} (branch)`;

  // Create the new conversation + copy messages in a transaction
  const branch = await db.$transaction(async (tx) => {
    const newConv = await tx.conversation.create({
      data: {
        profileId,
        title: branchTitle,
        modelId: source.modelId,
        systemPrompt: source.systemPrompt,
        branchedFromId: conversationId,
        branchedFromMessageId: messageId,
      },
    });
    for (const m of messagesToCopy) {
      await tx.message.create({
        data: {
          conversationId: newConv.id,
          role: m.role,
          content: m.content,
          modelId: m.modelId,
          reasoning: m.reasoning,
          createdAt: m.createdAt,
        },
      });
    }
    return newConv;
  });

  return NextResponse.json({ conversationId: branch.id });
}
