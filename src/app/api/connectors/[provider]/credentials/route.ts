import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors";

const schema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { provider } = await ctx.params;
  const conn = getConnector(provider);
  if (!conn) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { clientId, clientSecret } = parsed.data;
  const encryptedSecret = encrypt(clientSecret);

  const existing = await db.connector.findUnique({
    where: { profileId_provider: { profileId: session.profileId, provider } },
  });

  if (existing) {
    await db.connector.update({
      where: { id: existing.id },
      data: { clientId, encryptedSecret },
    });
  } else {
    await db.connector.create({
      data: {
        profileId: session.profileId,
        provider,
        clientId,
        encryptedSecret,
        scopes: JSON.stringify(conn.scopes),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
