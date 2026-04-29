import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { createProfile } from "@/lib/profiles";

const schema = z.object({
  username: z.string().min(2).max(32),
  displayName: z.string().min(1).max(64),
  password: z.string().min(6).max(200),
  avatarMonogram: z.string().min(1).max(3).optional(),
  avatarAccent: z.enum(["cyan", "mint", "ink"]).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });

  try {
    const profile = await createProfile(parsed.data);
    const session = await getSession();
    session.profileId = profile.id;
    session.username = profile.username;
    await session.save();
    return NextResponse.json({ ok: true, profile: { id: profile.id, username: profile.username, displayName: profile.displayName } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "registration failed" }, { status: 400 });
  }
}
