import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

type RouteCtx = { params: Promise<{ serverId: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  command: z.string().min(1).max(500).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
});

async function authOwn(serverId: string, profileId: string) {
  return db.mcpServer.findFirst({ where: { id: serverId, profileId } });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { serverId } = await ctx.params;
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const existing = await authOwn(serverId, session.profileId);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const { name, command, args, env, enabled } = parsed.data;
  const server = await db.mcpServer.update({
    where: { id: serverId },
    data: {
      ...(name !== undefined && { name }),
      ...(command !== undefined && { command }),
      ...(args !== undefined && { args: JSON.stringify(args) }),
      ...(env !== undefined && { env: JSON.stringify(env) }),
      ...(enabled !== undefined && { enabled }),
    },
  });
  return NextResponse.json({ server });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { serverId } = await ctx.params;
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const existing = await authOwn(serverId, session.profileId);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.mcpServer.delete({ where: { id: serverId } });
  return NextResponse.json({ ok: true });
}
