import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const webhook = await db.webhook.findUnique({ where: { slug } });
  if (!webhook) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rawBody = await req.text();

  // Validate HMAC-SHA256 signature
  const sigHeader = req.headers.get("x-openmlc-signature") ?? "";
  const expected = createHmac("sha256", webhook.secret).update(rawBody).digest("hex");

  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
  } catch {
    valid = false;
  }

  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let bodyPayload: Record<string, unknown> = {};
  try {
    bodyPayload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    bodyPayload = {};
  }

  let presetPayload: Record<string, unknown> = {};
  try {
    presetPayload = JSON.parse(webhook.presetPayload) as Record<string, unknown>;
  } catch {
    presetPayload = {};
  }

  const mergedPayload = { ...presetPayload, ...bodyPayload };

  const run = await db.workflowRun.create({
    data: {
      profileId: webhook.profileId,
      webhookId: webhook.id,
      status: "completed",
      output: JSON.stringify({ message: "stub: webhook dispatch logged", payload: mergedPayload }),
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  console.log("[webhook] dispatched", slug, "kind:", webhook.kind, "run:", run.id);

  return NextResponse.json({ ok: true, runId: run.id });
}
