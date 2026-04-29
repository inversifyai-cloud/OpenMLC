import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const createSchema = z.object({
  kind: z.enum(["chat", "swarm"]),
  presetPayload: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const webhooks = await db.webhook.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "desc" },
    // Never return secret in list
    select: { id: true, slug: true, kind: true, presetPayload: true, createdAt: true },
  });

  return NextResponse.json({ webhooks });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });

  const { kind, presetPayload } = parsed.data;

  const slug = randomBytes(6).toString("hex"); // 12 hex chars
  const secret = randomBytes(32).toString("hex");

  const webhook = await db.webhook.create({
    data: {
      profileId: session.profileId,
      slug,
      kind,
      presetPayload: JSON.stringify(presetPayload),
      secret, // plain text, self-hosted BYOK — per plan
    },
  });

  // Return secret ONCE in creation response
  return NextResponse.json({
    webhook: {
      id: webhook.id,
      slug: webhook.slug,
      kind: webhook.kind,
      presetPayload: webhook.presetPayload,
      createdAt: webhook.createdAt,
    },
    secret,
  }, { status: 201 });
}
