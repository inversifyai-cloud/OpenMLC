import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors";

function redirectUri(req: Request, provider: string): string {
  const url = new URL(req.url);
  return `${url.origin}/api/connectors/${provider}/callback`;
}

function settingsRedirect(req: Request, params: Record<string, string>): NextResponse {
  const url = new URL(req.url);
  const target = new URL("/settings/connectors", url.origin);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return NextResponse.redirect(target);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const conn = getConnector(provider);
  if (!conn) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return settingsRedirect(req, { error: `${provider}:${error}` });
  }
  if (!code || !state) {
    return settingsRedirect(req, { error: `${provider}:missing_code_or_state` });
  }

  const stateRow = await db.connectorOAuthState.findUnique({ where: { state } });
  if (!stateRow || stateRow.provider !== provider || stateRow.expiresAt < new Date()) {
    if (stateRow) await db.connectorOAuthState.delete({ where: { state } }).catch(() => {});
    return settingsRedirect(req, { error: `${provider}:invalid_state` });
  }

  // consume state
  await db.connectorOAuthState.delete({ where: { state } }).catch(() => {});

  const row = await db.connector.findUnique({
    where: { profileId_provider: { profileId: stateRow.profileId, provider } },
  });
  if (!row) return settingsRedirect(req, { error: `${provider}:no_credentials` });

  let clientSecret: string;
  try { clientSecret = decrypt(row.encryptedSecret); }
  catch { return settingsRedirect(req, { error: `${provider}:decrypt_failed` }); }

  let tokens;
  try {
    tokens = await conn.tokenExchange({
      code,
      clientId: row.clientId,
      clientSecret,
      redirectUri: redirectUri(req, provider),
    });
  } catch (err) {
    console.error(`[connectors:${provider}] token exchange failed`, err);
    return settingsRedirect(req, { error: `${provider}:token_exchange_failed` });
  }

  let account = null;
  try { account = await conn.fetchAccount(tokens.accessToken); }
  catch (err) { console.error(`[connectors:${provider}] fetchAccount failed`, err); }

  const expiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null;

  await db.connector.update({
    where: { id: row.id },
    data: {
      encryptedAccess: encrypt(tokens.accessToken),
      encryptedRefresh: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      expiresAt,
      scopes: tokens.scope ? JSON.stringify(tokens.scope.split(/[,\s]+/).filter(Boolean)) : row.scopes,
      accountInfo: account ? JSON.stringify(account) : null,
      enabled: true,
    },
  });

  return settingsRedirect(req, { connected: provider });
}
