import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { encrypt, isByokAvailable } from "@/lib/encryption";

const modelSchema = z.object({
  providerModelId: z.string().min(1).max(120),
  name: z.string().max(80).optional(),
  contextWindow: z.number().int().positive().optional(),
  vision: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().max(400).optional().nullable(),
  models: z.array(modelSchema).min(1).max(50).optional(),
  enabled: z.boolean().optional(),
});

async function authOwn(id: string, profileId: string) {
  const cp = await db.customProvider.findUnique({ where: { id }, select: { id: true, profileId: true } });
  if (!cp || cp.profileId !== profileId) return null;
  return cp;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const own = await authOwn(id, session.profileId);
  if (!own) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.baseUrl !== undefined) data.baseUrl = parsed.data.baseUrl;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.models !== undefined) data.models = JSON.stringify(parsed.data.models);
  if (parsed.data.apiKey !== undefined) {
    if (parsed.data.apiKey === null || parsed.data.apiKey === "") {
      data.encryptedKey = null;
    } else if (isByokAvailable()) {
      data.encryptedKey = encrypt(parsed.data.apiKey);
    }
  }
  await db.customProvider.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const own = await authOwn(id, session.profileId);
  if (!own) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.customProvider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
