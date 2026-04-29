import type { Model } from "@/types/chat";

type OllamaTag = {
  name: string;
  model: string;
  size?: number;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
};

const TTL_MS = 60 * 1000;

const cache = new Map<string, { at: number; models: Model[] }>();

function rootOf(baseUrl: string): string {

  return baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");
}

function transform(tag: OllamaTag, baseUrl: string): Model {
  const id = tag.model || tag.name;
  const sizeStr = tag.details?.parameter_size;
  const desc = sizeStr ? `local · ${sizeStr}` : "local · ollama";
  return {
    id: `ollama:${id}@${baseUrl}`,
    name: id.replace(/:latest$/, ""),
    providerId: "ollama",
    providerModelId: id,
    capabilities: ["text"],
    contextWindow: 32768,
    description: desc,
    costTier: "free",
  };
}

export async function fetchOllamaCatalog(baseUrl: string): Promise<Model[]> {
  const root = rootOf(baseUrl);
  const cached = cache.get(root);
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.models;

  try {
    const res = await fetch(`${root}/api/tags`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) throw new Error(`ollama tags HTTP ${res.status}`);
    const data = (await res.json()) as { models?: OllamaTag[] };
    const tags = data.models ?? [];
    const models = tags
      .map((t) => transform(t, baseUrl))
      .sort((a, b) => a.name.localeCompare(b.name));
    cache.set(root, { at: now, models });
    return models;
  } catch (err) {

    cache.set(root, { at: now, models: [] });
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ollama] unreachable at ${root}: ${err instanceof Error ? err.message : err}`);
    }
    return [];
  }
}
