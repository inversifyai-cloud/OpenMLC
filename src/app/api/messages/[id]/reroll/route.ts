/**
 * POST /api/messages/[id]/reroll
 *
 * Spawns a fresh assistant variant for the user message that produced the
 * given assistant message. The new variant is persisted with
 * `parentUserMessageId` + `variantIndex = max+1` and becomes the visible
 * variant via `Conversation.selectedVariants`.
 *
 * NOTE on duplication: rather than refactor the existing chat route
 * (which is large and being touched by other agents), we extracted only
 * the reroll-relevant slice into `src/lib/chat/turn.ts`. The chat route
 * itself is untouched — pragmatism per the v4 brief.
 */
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { streamAssistantTurn } from "@/lib/chat/turn";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;

  const session = await getSession();
  if (!session.profileId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

  const assistantMsg = await db.message.findUnique({
    where: { id },
    include: {
      conversation: {
        select: { id: true, profileId: true, modelId: true, selectedVariants: true },
      },
    },
  });
  if (!assistantMsg || !assistantMsg.conversation) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (assistantMsg.conversation.profileId !== profileId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (assistantMsg.role !== "assistant") {
    return Response.json(
      { error: "only assistant messages can be rerolled" },
      { status: 400 },
    );
  }

  const conversationId = assistantMsg.conversationId;

  // Resolve the parent user message: prefer the explicit FK, else fall
  // back to the latest user message strictly before this assistant
  // message's createdAt.
  let parentUserMessageId = assistantMsg.parentUserMessageId;
  if (!parentUserMessageId) {
    const fallback = await db.message.findFirst({
      where: {
        conversationId,
        role: "user",
        createdAt: { lt: assistantMsg.createdAt },
        supersededAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!fallback) {
      return Response.json(
        { error: "no parent user message" },
        { status: 400 },
      );
    }
    parentUserMessageId = fallback.id;
  }

  const parentUserMsg = await db.message.findUnique({
    where: { id: parentUserMessageId },
    select: { id: true, createdAt: true },
  });
  if (!parentUserMsg) {
    return Response.json({ error: "parent missing" }, { status: 404 });
  }

  // Build chronological history up to and including the parent user
  // message. Exclude superseded rows. For variant selection, take the
  // currently-selected assistant variant per parent (or the latest if no
  // selection has been made).
  const allUpTo = await db.message.findMany({
    where: {
      conversationId,
      supersededAt: null,
      createdAt: { lte: parentUserMsg.createdAt },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      parentUserMessageId: true,
      variantIndex: true,
      createdAt: true,
    },
  });

  let selectedMap: Record<string, number> = {};
  try {
    const parsed = JSON.parse(
      assistantMsg.conversation.selectedVariants ?? "{}",
    );
    if (parsed && typeof parsed === "object") {
      selectedMap = parsed as Record<string, number>;
    }
  } catch {
    selectedMap = {};
  }

  // For each parent user message id, figure out which assistant variant
  // is currently visible.
  const variantsByParent = new Map<
    string,
    Array<{ id: string; variantIndex: number; createdAt: Date }>
  >();
  for (const m of allUpTo) {
    if (m.role === "assistant" && m.parentUserMessageId) {
      const arr = variantsByParent.get(m.parentUserMessageId) ?? [];
      arr.push({ id: m.id, variantIndex: m.variantIndex, createdAt: m.createdAt });
      variantsByParent.set(m.parentUserMessageId, arr);
    }
  }
  const visibleAssistantIds = new Set<string>();
  for (const [pid, arr] of variantsByParent.entries()) {
    const desired = selectedMap[pid];
    let pick = arr.find((v) => v.variantIndex === desired);
    if (!pick) {
      // Fallback to the most recent variant (max variantIndex, then latest createdAt).
      pick = [...arr].sort(
        (a, b) =>
          b.variantIndex - a.variantIndex ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];
    }
    if (pick) visibleAssistantIds.add(pick.id);
  }

  const history = allUpTo.filter((m) => {
    if (m.role === "user") return true;
    if (m.role === "assistant") {
      // Legacy assistants without a parentUserMessageId: keep them as-is
      // (pre-reroll history).
      if (!m.parentUserMessageId) return true;
      return visibleAssistantIds.has(m.id);
    }
    return false;
  });

  return streamAssistantTurn({
    profileId,
    conversationId,
    modelId: assistantMsg.conversation.modelId,
    history: history.map((m) => ({ id: m.id, role: m.role, content: m.content })),
    parentUserMessageId,
    selectAsVisible: true,
    abortSignal: req.signal,
  });
}
