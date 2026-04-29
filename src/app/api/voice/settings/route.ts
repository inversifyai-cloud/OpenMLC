import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const VOICES = ["alloy", "echo", "fable", "nova", "onyx", "shimmer"] as const;

const patchSchema = z.object({
  ttsVoice: z.enum(VOICES).optional(),
  ttsAutoPlay: z.boolean().optional(),
  ttsSpeed: z.number().min(0.25).max(4.0).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await db.profile.findUnique({
    where: { id: session.profileId },
    select: { ttsVoice: true, ttsAutoPlay: true, ttsSpeed: true },
  });
  return NextResponse.json({
    ttsVoice: profile?.ttsVoice ?? "nova",
    ttsAutoPlay: profile?.ttsAutoPlay ?? false,
    ttsSpeed: profile?.ttsSpeed ?? 1.0,
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const updated = await db.profile.update({
    where: { id: session.profileId },
    data: parsed.data,
    select: { ttsVoice: true, ttsAutoPlay: true, ttsSpeed: true },
  });
  return NextResponse.json(updated);
}
