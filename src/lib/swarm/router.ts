import type { AgentSpec, ResolvedAgent, ReasoningEffort } from "./types";
import { getCombinedCatalog } from "@/lib/providers/catalog";
import type { Model } from "@/types/chat";

const CAPABILITY_PREFERENCE: Record<AgentSpec["suggestedCapability"], string[]> = {
  // ordered: highest preference → lowest. Each entry matches against model.id (substring).
  research: ["gemini-2.5-pro", "claude-sonnet", "gpt-5", "gemini-pro", "claude-opus", "gpt-4o"],
  code: ["claude-opus", "gpt-5", "claude-sonnet", "gpt-4o", "deepseek-coder"],
  reasoning: ["o1", "o3", "claude-opus", "gpt-5", "claude-sonnet"],
  fast: ["claude-haiku", "gemini-flash", "gpt-4o-mini", "gpt-5-mini", "gpt-5-nano", "llama"],
  general: ["claude-sonnet", "gpt-4o", "gemini-pro", "gpt-4o-mini"],
};

export async function pickAgentSpecs(opts: {
  profileId: string;
  agents: AgentSpec[];
  enabledProviders: string[];
  reasoningEffort: ReasoningEffort;
}): Promise<ResolvedAgent[]> {
  const catalog = await getCombinedCatalog(opts.profileId);
  const enabled = catalog.filter(
    (m) => opts.enabledProviders.length === 0 || opts.enabledProviders.includes(m.providerId)
  );

  const resolved: ResolvedAgent[] = [];
  for (const spec of opts.agents) {
    const model = pickModel(enabled, spec.suggestedCapability, opts.reasoningEffort);
    if (!model) {
      // Fallback: any text-capable model
      const fallback = enabled.find((m) => m.capabilities.includes("text"));
      if (!fallback) throw new Error("No models available for swarm");
      resolved.push({ ...spec, modelId: fallback.id, providerId: fallback.providerId });
    } else {
      resolved.push({ ...spec, modelId: model.id, providerId: model.providerId });
    }
  }
  return resolved;
}

function pickModel(catalog: Model[], capability: AgentSpec["suggestedCapability"], effort: ReasoningEffort): Model | null {
  const prefs = CAPABILITY_PREFERENCE[capability];
  for (const needle of prefs) {
    const hit = catalog.find((m) => m.id.includes(needle) && m.capabilities.includes("text"));
    if (hit) {
      // For low effort, prefer cheaper variant
      if (effort === "low") {
        const cheaper = catalog.find(
          (m) =>
            m.id.includes(needle) &&
            (m.id.includes("mini") || m.id.includes("haiku") || m.id.includes("flash") || m.id.includes("nano")) &&
            m.capabilities.includes("text")
        );
        if (cheaper) return cheaper;
      }
      return hit;
    }
  }
  return null;
}
