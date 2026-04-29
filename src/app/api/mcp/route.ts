import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  command: z.string().min(1).max(500),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const servers = await db.mcpServer.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ servers });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { name, command, args, env } = parsed.data;
  const server = await db.mcpServer.create({
    data: {
      profileId: session.profileId,
      name,
      command,
      args: JSON.stringify(args),
      env: JSON.stringify(env),
    },
  });
  return NextResponse.json({ server }, { status: 201 });
}
