import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { getConnector } from "./index";
import type { Connector } from "@prisma/client";

/**
 * Returns a live access token for the connector, refreshing if needed.
 * Updates the DB row with new tokens when refreshed.
 */
export async function refreshIfExpired(row: Connector): Promise<{ accessToken: string }> {
  if (!row.encryptedAccess) {
    throw new Error(`connector ${row.provider} has no access token`);
  }

  const conn = getConnector(row.provider);
  if (!conn) throw new Error(`unknown connector ${row.provider}`);

  const now = Date.now();
  const expiresMs = row.expiresAt ? row.expiresAt.getTime() : null;
  const needsRefresh =
    expiresMs !== null && expiresMs - now < 60_000 && row.encryptedRefresh && conn.refresh;

  if (!needsRefresh) {
    return { accessToken: decrypt(row.encryptedAccess) };
  }

  const refreshToken = decrypt(row.encryptedRefresh!);
  const clientSecret = decrypt(row.encryptedSecret);

  try {
    const result = await conn.refresh!({
      refreshToken,
      clientId: row.clientId,
      clientSecret,
    });

    const newExpiresAt = result.expiresIn ? new Date(Date.now() + result.expiresIn * 1000) : null;
    const data: Partial<{
      encryptedAccess: string;
      encryptedRefresh: string;
      expiresAt: Date | null;
    }> = {
      encryptedAccess: encrypt(result.accessToken),
      expiresAt: newExpiresAt,
    };
    if (result.refreshToken) data.encryptedRefresh = encrypt(result.refreshToken);

    await db.connector.update({ where: { id: row.id }, data });
    return { accessToken: result.accessToken };
  } catch (err) {
    // refresh failed — fall back to the existing token; caller will see API failure
    console.error(`[connectors] refresh failed for ${row.provider}`, err);
    return { accessToken: decrypt(row.encryptedAccess) };
  }
}
