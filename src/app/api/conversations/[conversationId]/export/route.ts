import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ conversationId: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const { conversationId } = await ctx.params;
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, modelId: true, createdAt: true },
      },
    },
  });
  if (!conv || conv.profileId !== session.profileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "json" ? "json" : "md";

  if (format === "json") {
    return new NextResponse(
      JSON.stringify({ conversation: conv }, null, 2),
      {
        headers: {
          "content-type": "application/json",
          "content-disposition": `attachment; filename="${conversationId}.json"`,
        },
      }
    );
  }

  // markdown
  const lines: string[] = [
    `# ${conv.title || "Untitled Conversation"}`,
    ``,
    `> Exported from openMLC · ${new Date().toISOString()}`,
    ``,
  ];
  for (const msg of conv.messages) {
    const role = msg.role === "assistant" ? `**assistant** (${msg.modelId ?? "?"})` : `**${msg.role}**`;
    lines.push(`---`);
    lines.push(``);
    lines.push(`### ${role}`);
    lines.push(``);
    lines.push(msg.content);
    lines.push(``);
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${conversationId}.md"`,
    },
  });
}
