import type { Model, ModelCapability } from "@/types/chat";

/**
 * Live OpenRouter catalog fetcher.
 *
 * OpenRouter exposes its full model directory at https://openrouter.ai/api/v1/models
 * with no auth required. We fetch + normalize once per TTL and serve from a
 * module-scope cache.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/models";
const TTL_MS = 60 * 60 * 1000; // 1 hour

type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
};

type Cache = { at: number; models: Model[] } | null;
let cache: Cache = null;
let inflight: Promise<Model[]> | null = null;

function deriveCapabilities(or: OpenRouterModel): ModelCapability[] {
  const caps: ModelCapability[] = [];
  const inputs = or.architecture?.input_modalities ?? [];
  const outputs = or.architecture?.output_modalities ?? [];
  const params = or.supported_parameters ?? [];

  if (inputs.includes("text") || outputs.includes("text") || inputs.length === 0) caps.push("text");
  if (inputs.includes("image")) caps.push("vision");
  if (outputs.includes("image")) caps.push("image-gen");
  if (inputs.includes("audio") || outputs.includes("audio")) caps.push("audio");
  if (params.includes("tools") || params.includes("tool_choice")) caps.push("tools");
  if (params.includes("reasoning") || params.includes("include_reasoning")) caps.push("reasoning");
  return caps;
}

function deriveCostTier(or: OpenRouterModel): "free" | "low" | "medium" | "high" {
  const promptStr = or.pricing?.prompt ?? "0";
  const promptPrice = parseFloat(promptStr);
  if (!isFinite(promptPrice) || promptPrice === 0) return "free";
  // Pricing is per token; crude buckets that match the curated registry.
  if (promptPrice < 0.000001) return "low";
  if (promptPrice < 0.00001) return "medium";
  return "high";
}

function shortDesc(d?: string): string {
  if (!d) return "";
  // First sentence, capped at ~140 chars.
  const firstSentence = d.split(/(?<=[.!?])\s/)[0] ?? d;
  return firstSentence.slice(0, 140).replace(/\s+/g, " ").trim();
}

/**
 * Vendors we have direct native integration for. Models from these vendors
 * should NOT appear in the OpenRouter catalog — they live under their own
 * provider in the picker.
 */
const NATIVELY_INTEGRATED_VENDORS = new Set([
  "openai",
  "anthropic",
  "x-ai",
  "xai",
]);

/**
 * Decide whether an OpenRouter model belongs in the OpenRouter dynamic catalog.
 * Strips out anything we have a direct API path for so the picker doesn't show
 * "GPT-4o" twice (once under OpenAI, once under OpenRouter).
 */
function shouldKeepInOrCatalog(orModelId: string): boolean {
  const slash = orModelId.indexOf("/");
  if (slash === -1) return true;
  // Strip leading "~" used for OpenRouter alias/shortcut entries
  // (e.g. "~anthropic/claude-haiku-latest" → vendor "anthropic").
  let vendor = orModelId.slice(0, slash).toLowerCase();
  if (vendor.startsWith("~")) vendor = vendor.slice(1);
  const rest = orModelId.slice(slash + 1).toLowerCase();

  if (NATIVELY_INTEGRATED_VENDORS.has(vendor)) return false;

  // Google: we have direct Gemini access, so strip gemini-* and gemma is fine
  // (Gemma isn't on the Google generativelanguage API, only on OpenRouter).
  if (vendor === "google" && rest.startsWith("gemini")) return false;

  return true;
}

function transform(or: OpenRouterModel): Model {
  return {
    id: `or:${or.id}`,
    name: or.name?.replace(/\s*\(free\)\s*$/i, "") ?? or.id,
    providerId: "openrouter",
    providerModelId: or.id,
    description: shortDesc(or.description),
    contextWindow: or.context_length ?? undefined,
    capabilities: deriveCapabilities(or),
    costTier: deriveCostTier(or),
  };
}

async function fetchFromOpenRouter(): Promise<Model[]> {
  const res = await fetch(ENDPOINT, {
    headers: { accept: "application/json" },
    // 30s timeout via AbortSignal.timeout (Node 18+/Next 16)
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`openrouter catalog: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { data?: OpenRouterModel[] };
  const list = data.data ?? [];
  return list
    .filter((m) => shouldKeepInOrCatalog(m.id))
    .map(transform)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOpenRouterCatalog(): Promise<Model[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.models;
  if (inflight) return inflight;

  inflight = fetchFromOpenRouter()
    .then((models) => {
      cache = { at: Date.now(), models };
      return models;
    })
    .catch((err) => {
      console.warn("[openrouter] catalog fetch failed:", err?.message ?? err);
      // Serve stale cache if present, otherwise empty.
      return cache?.models ?? [];
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Force a refresh on the next call. */
export function invalidateOpenRouterCatalog(): void {
  cache = null;
}
