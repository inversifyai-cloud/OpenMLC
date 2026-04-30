import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const patchSchema = z.object({
  startScreen: z.enum(["home", "chat"]),
});

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
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const updated = await db.profile.update({
    where: { id: session.profileId },
    data: { startScreen: parsed.data.startScreen },
    select: { startScreen: true },
  });

  return NextResponse.json({ startScreen: updated.startScreen });
}
