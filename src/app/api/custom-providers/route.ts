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

const createSchema = z.object({
  name: z.string().min(1).max(60),
  baseUrl: z.string().url(),
  apiKey: z.string().max(400).optional(),
  models: z.array(modelSchema).min(1).max(50),
  enabled: z.boolean().optional().default(true),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await db.customProvider.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, baseUrl: true, models: true, enabled: true, createdAt: true, encryptedKey: true },
  });
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    baseUrl: r.baseUrl,
    models: r.models,
    enabled: r.enabled,
    createdAt: r.createdAt,
    hasKey: !!r.encryptedKey,
  }));
  return NextResponse.json({ providers: items });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 });
  const { name, baseUrl, apiKey, models, enabled } = parsed.data;
  let encryptedKey: string | null = null;
  if (apiKey && isByokAvailable()) {
    encryptedKey = encrypt(apiKey);
  }
  const cp = await db.customProvider.create({
    data: {
      profileId: session.profileId,
      name,
      baseUrl,
      encryptedKey,
      models: JSON.stringify(models),
      enabled,
    },
  });
  return NextResponse.json({ id: cp.id }, { status: 201 });
}
