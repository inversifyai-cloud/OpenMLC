import { z } from "zod";
import { getSession } from "@/lib/session";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  voice: z.string().min(1).max(32).optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const resolved = await resolveProviderKey(session.profileId, "openai");
  if (!resolved) {
    return Response.json({ error: "no_api_key" }, { status: 402 });
  }

  const profile = await db.profile.findUnique({
    where: { id: session.profileId },
    select: { ttsVoice: true, ttsSpeed: true },
  });

  const voice = parsed.data.voice ?? profile?.ttsVoice ?? "nova";
  const speed = parsed.data.speed ?? profile?.ttsSpeed ?? 1.0;
  const input = parsed.data.text.slice(0, 4096);

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolved.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice,
      input,
      speed,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return Response.json(
      { error: `tts upstream error: ${err}` },
      { status: upstream.status }
    );
  }

  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
