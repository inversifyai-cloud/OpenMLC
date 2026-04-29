import { db } from "@/lib/db";
import { decrypt, isByokAvailable } from "@/lib/encryption";
import type { ProviderId } from "@/types/chat";

const ENV_VAR: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai: "XAI_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  ollama: "",
};

export type ResolvedKey = {
  key: string;
  baseUrl?: string;
  source: "byok" | "env";
};

export async function resolveProviderKey(
  profileId: string,
  providerId: ProviderId
): Promise<ResolvedKey | null> {

  if (isByokAvailable()) {
    try {
      const row = await db.profileApiKey.findUnique({
        where: { profileId_provider: { profileId, provider: providerId } },
      });
      if (row?.encryptedKey) {
        const key = decrypt(row.encryptedKey);
        return { key, baseUrl: row.baseUrl ?? undefined, source: "byok" };
      }
    } catch {

    }
  }

  const envName = ENV_VAR[providerId];
  if (envName) {
    const raw = process.env[envName];
    if (raw) {

      const key = raw.replace(/^"+|"+$/g, "");
      if (key) return { key, source: "env" };
    }
  }

  if (providerId === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
    return { key: "ollama", baseUrl, source: "env" };
  }

  return null;
}
