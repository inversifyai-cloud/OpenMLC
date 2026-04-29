import { models as STATIC_MODELS } from "./registry";
import { getOpenRouterCatalog } from "./openrouter";
import { fetchOllamaCatalog } from "./ollama";
import { resolveProviderKey } from "./resolve-key";
import type { Model } from "@/types/chat";

export async function getCombinedCatalog(profileId?: string): Promise<Model[]> {
  const orModels = await getOpenRouterCatalog();

  const curatedOpenRouterIds = new Set(
    STATIC_MODELS
      .filter((m) => m.providerId === "openrouter")
      .map((m) => m.providerModelId)
  );

  const dynamicOr = orModels.filter(
    (m) => !curatedOpenRouterIds.has(m.providerModelId)
  );

  let ollamaModels: Model[] = [];
  if (profileId) {
    const resolved = await resolveProviderKey(profileId, "ollama");
    if (resolved?.baseUrl) {
      ollamaModels = await fetchOllamaCatalog(resolved.baseUrl);
    }
  }

  return [...STATIC_MODELS, ...ollamaModels, ...dynamicOr];
}

export async function findModel(id: string, profileId?: string): Promise<Model | null> {
  const fromStatic = STATIC_MODELS.find((m) => m.id === id);
  if (fromStatic) return fromStatic;

  if (id.startsWith("or:")) {
    const orModels = await getOpenRouterCatalog();
    return orModels.find((m) => m.id === id) ?? null;
  }

  if (id.startsWith("ollama:") && profileId) {
    const resolved = await resolveProviderKey(profileId, "ollama");
    if (resolved?.baseUrl) {
      const tags = await fetchOllamaCatalog(resolved.baseUrl);
      return tags.find((m) => m.id === id) ?? null;
    }
  }

  return null;
}
