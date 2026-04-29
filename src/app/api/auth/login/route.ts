import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { verifyPassword } from "@/lib/profiles";

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  const profile = await verifyPassword(parsed.data.username, parsed.data.password);
  if (!profile) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const session = await getSession();
  session.profileId = profile.id;
  session.username = profile.username;
  await session.save();

  return NextResponse.json({ ok: true, profile: { id: profile.id, username: profile.username, displayName: profile.displayName } });
}
