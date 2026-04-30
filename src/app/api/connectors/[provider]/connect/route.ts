import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors";

function redirectUri(req: Request, provider: string): string {
  const url = new URL(req.url);
  return `${url.origin}/api/connectors/${provider}/callback`;
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { provider } = await ctx.params;
  const conn = getConnector(provider);
  if (!conn) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const row = await db.connector.findUnique({
    where: { profileId_provider: { profileId: session.profileId, provider } },
  });
  if (!row) {
    return NextResponse.json(
      { error: "no oauth credentials saved for this provider — save clientId/clientSecret first" },
      { status: 400 },
    );
  }

  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await db.connectorOAuthState.create({
    data: { state, profileId: session.profileId, provider, expiresAt },
  });

  // best-effort cleanup of expired states
  void db.connectorOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

  // verify decrypt works (not used but ensures encryption key configured)
  try { decrypt(row.encryptedSecret); } catch {
    return NextResponse.json({ error: "encryption key misconfigured" }, { status: 500 });
  }

  const url = conn.authUrl({
    clientId: row.clientId,
    redirectUri: redirectUri(req, provider),
    state,
  });

  return NextResponse.redirect(url);
}
