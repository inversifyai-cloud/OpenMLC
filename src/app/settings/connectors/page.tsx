import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CONNECTORS } from "@/lib/connectors";
import { ConnectorsManager, type ConnectorView } from "./ConnectorsManager";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");

  const rows = await db.connector.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "asc" },
  });
  const byProvider = new Map(rows.map((r) => [r.provider, r] as const));

  const connectors: ConnectorView[] = Object.values(CONNECTORS).map((def) => {
    const row = byProvider.get(def.id);
    let accountInfo: { login?: string; email?: string; name?: string } | null = null;
    if (row?.accountInfo) {
      try { accountInfo = JSON.parse(row.accountInfo); } catch { accountInfo = null; }
    }
    return {
      provider: def.id,
      displayName: def.displayName,
      scopes: def.scopes,
      configured: !!row,
      hasAccessToken: !!row?.encryptedAccess,
      enabled: row?.enabled ?? false,
      accountInfo,
      clientId: row?.clientId ?? null,
    };
  });

  return <ConnectorsManager initial={connectors} />;
}
