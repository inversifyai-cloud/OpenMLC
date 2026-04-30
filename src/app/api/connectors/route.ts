import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CONNECTORS } from "@/lib/connectors";

export async function GET() {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db.connector.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "asc" },
  });

  const byProvider = new Map(rows.map((r) => [r.provider, r] as const));

  const connectors = Object.values(CONNECTORS).map((def) => {
    const row = byProvider.get(def.id);
    let accountInfo: unknown = null;
    if (row?.accountInfo) {
      try { accountInfo = JSON.parse(row.accountInfo); } catch { accountInfo = null; }
    }
    return {
      provider: def.id,
      displayName: def.displayName,
      scopes: def.scopes,
      configured: !!row,
      hasAccessToken: !!row?.encryptedAccess,
      hasRefreshToken: !!row?.encryptedRefresh,
      enabled: row?.enabled ?? false,
      accountInfo,
      expiresAt: row?.expiresAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ connectors });
}
