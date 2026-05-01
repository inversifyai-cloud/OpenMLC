import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const patchSchema = z.object({
  codeSandboxEnabled: z.boolean().optional(),
  swarmEnabled: z.boolean().optional(),
  computerAgentUrl: z.string().url().nullish(),
  computerAgentToken: z.string().nullish(),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return NextResponse.json({
    codeSandboxEnabled: settings.codeSandboxEnabled,
    swarmEnabled: settings.swarmEnabled,
    computerAgentUrl: settings.computerAgentUrl ?? null,
    hasComputerAgentToken: !!settings.computerAgentToken,
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const settings = await db.settings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });
  return NextResponse.json({
    codeSandboxEnabled: settings.codeSandboxEnabled,
    swarmEnabled: settings.swarmEnabled,
    computerAgentUrl: settings.computerAgentUrl ?? null,
    hasComputerAgentToken: !!settings.computerAgentToken,
  });
}
