import { db } from "@/lib/db";
import { decrypt, isByokAvailable } from "@/lib/encryption";
import type { Model } from "@/types/chat";

export type CustomModelEntry = {
  providerModelId: string;
  name?: string;
  contextWindow?: number;
  vision?: boolean;
};

export type CustomProviderRow = {
  id: string;
  name: string;
  baseUrl: string;
  encryptedKey: string | null;
  models: string;
  enabled: boolean;
};

export function parseModels(raw: string): CustomModelEntry[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m: unknown): CustomModelEntry | null => {
        if (!m || typeof m !== "object") return null;
        const obj = m as Record<string, unknown>;
        const providerModelId = typeof obj.providerModelId === "string" ? obj.providerModelId : null;
        if (!providerModelId) return null;
        return {
          providerModelId,
          name: typeof obj.name === "string" ? obj.name : undefined,
          contextWindow: typeof obj.contextWindow === "number" ? obj.contextWindow : undefined,
          vision: obj.vision === true,
        };
      })
      .filter((m): m is CustomModelEntry => m !== null);
  } catch {
    return [];
  }
}

export function customModelToCatalog(cp: CustomProviderRow, m: CustomModelEntry): Model {
  return {
    id: `cprov:${cp.id}:${m.providerModelId}`,
    name: m.name ?? m.providerModelId,
    providerId: "custom" as never,
    providerModelId: m.providerModelId,
    capabilities: m.vision ? ["text", "vision", "tools"] : ["text", "tools"],
    contextWindow: m.contextWindow,
    description: `via ${cp.name}`,
  };
}

export async function listCustomCatalogForProfile(profileId: string): Promise<Model[]> {
  const providers = await db.customProvider.findMany({
    where: { profileId, enabled: true },
    select: { id: true, name: true, baseUrl: true, encryptedKey: true, models: true, enabled: true },
  });
  const out: Model[] = [];
  for (const p of providers) {
    for (const m of parseModels(p.models)) {
      out.push(customModelToCatalog(p, m));
    }
  }
  return out;
}

export function parseCustomModelId(id: string): { customProviderId: string; providerModelId: string } | null {
  if (!id.startsWith("cprov:")) return null;
  const rest = id.slice("cprov:".length);
  const colon = rest.indexOf(":");
  if (colon === -1) return null;
  return {
    customProviderId: rest.slice(0, colon),
    providerModelId: rest.slice(colon + 1),
  };
}

export async function findCustomModel(id: string, profileId?: string): Promise<Model | null> {
  if (!profileId) return null;
  const parsed = parseCustomModelId(id);
  if (!parsed) return null;
  const cp = await db.customProvider.findFirst({
    where: { id: parsed.customProviderId, profileId, enabled: true },
  });
  if (!cp) return null;
  const entry = parseModels(cp.models).find((m) => m.providerModelId === parsed.providerModelId);
  if (!entry) return null;
  return customModelToCatalog(cp, entry);
}

export async function resolveCustomProvider(profileId: string, customProviderId: string): Promise<{ key: string; baseUrl: string; name: string } | null> {
  const cp = await db.customProvider.findFirst({
    where: { id: customProviderId, profileId, enabled: true },
  });
  if (!cp) return null;
  let key = "no-key";
  if (cp.encryptedKey && isByokAvailable()) {
    try { key = decrypt(cp.encryptedKey); } catch {}
  }
  return { key, baseUrl: cp.baseUrl, name: cp.name };
}
