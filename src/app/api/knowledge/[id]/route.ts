import { unlink } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { triggerFileProcessing } from "@/lib/ai/knowledge-rag";

type RouteCtx = { params: Promise<{ id: string }> };

async function authOwn(id: string) {
  const session = await getSession();
  if (!session.profileId) {
    return { error: "unauthorized" as const, status: 401, profileId: null, file: null };
  }
  const file = await db.knowledgeFile.findUnique({
    where: { id },
    select: { id: true, profileId: true, path: true },
  });
  if (!file || file.profileId !== session.profileId) {
    return { error: "not_found" as const, status: 404, profileId: null, file: null };
  }
  return { error: null, status: 200, profileId: session.profileId, file };
}

const patchSchema = z.object({
  active: z.boolean().optional(),
  reprocess: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const auth = await authOwn(id);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { active, reprocess } = parsed.data;
  const data: { active?: boolean; embeddingStatus?: string } = {};
  if (typeof active === "boolean") data.active = active;
  if (reprocess) data.embeddingStatus = "pending";

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "nothing to update" }, { status: 400 });
  }

  const updated = await db.knowledgeFile.update({
    where: { id },
    data,
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      active: true,
      embeddingStatus: true,
      createdAt: true,
    },
  });

  if (reprocess && auth.profileId) {
    triggerFileProcessing(id, auth.profileId);
  }

  return Response.json({ file: updated });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const auth = await authOwn(id);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const path = auth.file?.path;
  await db.knowledgeFile.delete({ where: { id } });

  if (path) {
    try {
      await unlink(join(process.cwd(), path));
    } catch (err) {
      console.error("[kb] failed to unlink file", err);
    }
  }

  return Response.json({ ok: true });
}
