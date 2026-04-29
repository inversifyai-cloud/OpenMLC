import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import type { ProviderId } from "@/types/chat";

export function getProviderModel(
  providerId: ProviderId,
  providerModelId: string,
  apiKey: string,
  baseUrl?: string
): LanguageModel {
  switch (providerId) {
    case "openai":
      return createOpenAI({ apiKey }).chat(providerModelId);
    case "anthropic":
      return createAnthropic({ apiKey })(providerModelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(providerModelId);
    case "xai":
      return createXai({ apiKey })(providerModelId);
    case "fireworks":
      return createOpenAI({
        apiKey,
        baseURL: "https://api.fireworks.ai/inference/v1",
      }).chat(providerModelId);
    case "openrouter":
      return createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": "https://openmlc.local",
          "X-Title": "OpenMLC",
        },
      }).chat(providerModelId);
    case "ollama":
      return createOpenAI({
        apiKey,
        baseURL: baseUrl ?? "http://localhost:11434/v1",
      }).chat(providerModelId);
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}
