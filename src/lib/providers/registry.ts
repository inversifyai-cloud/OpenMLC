import type { Model } from "@/types/chat";

export const models: Model[] = [

  {
    id: "gpt-4o", name: "GPT-4o", providerId: "openai", providerModelId: "gpt-4o",
    description: "Powerful multimodal model for complex tasks", contextWindow: 128000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    isDefault: true, bestFor: "General purpose", costTier: "medium",
  },
  {
    id: "gpt-4o-mini", name: "GPT-4o mini", providerId: "openai", providerModelId: "gpt-4o-mini",
    description: "Fast and affordable for everyday tasks", contextWindow: 128000,
    capabilities: ["text", "vision", "code", "tools"],
    bestFor: "Quick answers", costTier: "low",
  },
  {
    id: "gpt-5.4", name: "GPT-5.4", providerId: "openai", providerModelId: "gpt-5.4",
    description: "Latest GPT-5 flagship with exceptional reasoning", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Complex tasks", costTier: "high",
  },
  {
    id: "gpt-5.4-mini", name: "GPT-5.4 mini", providerId: "openai", providerModelId: "gpt-5.4-mini",
    description: "Balanced GPT-5 for everyday use at low cost", contextWindow: 128000,
    capabilities: ["text", "vision", "code", "tools"],
    bestFor: "Everyday use", costTier: "medium",
  },
  {
    id: "gpt-5.4-nano", name: "GPT-5.4 nano", providerId: "openai", providerModelId: "gpt-5.4-nano",
    description: "Smallest GPT-5 — ultra-fast for simple tasks", contextWindow: 128000,
    capabilities: ["text", "code"],
    bestFor: "Simple tasks", costTier: "low",
  },
  {
    id: "gpt-5.2", name: "GPT-5.2", providerId: "openai", providerModelId: "gpt-5.2",
    description: "Previous GPT-5 generation, strong all-rounder", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "General purpose", costTier: "medium",
  },
  {
    id: "gpt-4.1", name: "GPT-4.1", providerId: "openai", providerModelId: "gpt-4.1",
    description: "Latest GPT-4 with improved coding and instruction following", contextWindow: 1047576,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Long-context tasks", costTier: "medium",
  },
  {
    id: "gpt-4.1-mini", name: "GPT-4.1 mini", providerId: "openai", providerModelId: "gpt-4.1-mini",
    description: "Fast and cost-efficient with 1M context", contextWindow: 1047576,
    capabilities: ["text", "vision", "code", "tools"],
    bestFor: "Long context, low cost", costTier: "low",
  },
  {
    id: "gpt-4.1-nano", name: "GPT-4.1 nano", providerId: "openai", providerModelId: "gpt-4.1-nano",
    description: "Ultra-fast and ultra-cheap with 1M context", contextWindow: 1047576,
    capabilities: ["text", "code"],
    bestFor: "Simple tasks", costTier: "low",
  },

  {
    id: "o4-mini", name: "o4 mini", providerId: "openai", providerModelId: "o4-mini",
    description: "Compact reasoning model with strong performance", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Reasoning", costTier: "medium",
  },
  {
    id: "o3", name: "o3", providerId: "openai", providerModelId: "o3",
    description: "Advanced reasoning model for complex analysis", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Deep reasoning", costTier: "high",
  },
  {
    id: "o3-mini", name: "o3 mini", providerId: "openai", providerModelId: "o3-mini",
    description: "Fast reasoning model for math and logic", contextWindow: 200000,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Math & logic", costTier: "medium",
  },

  {
    id: "claude-opus-4-6", name: "Claude Opus 4.6", providerId: "anthropic", providerModelId: "claude-opus-4-6",
    description: "Most intelligent Claude — frontier-level reasoning and analysis", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Complex reasoning", costTier: "high",
  },
  {
    id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", providerId: "anthropic", providerModelId: "claude-sonnet-4-6",
    description: "Best balance of intelligence and speed", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Writing & analysis", costTier: "medium",
  },
  {
    id: "claude-haiku-4-5", name: "Claude Haiku 4.5", providerId: "anthropic", providerModelId: "claude-haiku-4-5-20251001",
    description: "Fastest and most compact Claude for quick tasks", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "tools"],
    bestFor: "Fast responses", costTier: "low",
  },
  {
    id: "claude-opus-4-5", name: "Claude Opus 4.5", providerId: "anthropic", providerModelId: "claude-opus-4-5",
    description: "Previous Opus generation — powerful for demanding tasks", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Deep tasks", costTier: "high",
  },
  {
    id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", providerId: "anthropic", providerModelId: "claude-sonnet-4-5",
    description: "Previous Sonnet generation with strong all-round capability", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Reliable all-rounder", costTier: "medium",
  },
  {
    id: "claude-opus-4", name: "Claude Opus 4", providerId: "anthropic", providerModelId: "claude-opus-4-20250514",
    description: "Earlier Opus — excellent for deep analysis and research", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Research", costTier: "high",
  },
  {
    id: "claude-sonnet-4", name: "Claude Sonnet 4", providerId: "anthropic", providerModelId: "claude-sonnet-4-20250514",
    description: "Earlier Sonnet generation, balanced performance and speed", contextWindow: 200000,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Balanced work", costTier: "medium",
  },

  {
    id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", providerId: "google", providerModelId: "gemini-2.5-pro",
    description: "Most capable Gemini 2.5 model with thinking", contextWindow: 1048576,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Long documents", costTier: "medium",
  },
  {
    id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", providerId: "google", providerModelId: "gemini-2.5-flash",
    description: "Fast model with built-in thinking capabilities", contextWindow: 1048576,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Fast reasoning", costTier: "low",
  },
  {
    id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", providerId: "google", providerModelId: "gemini-2.5-flash-lite",
    description: "Ultra-lightweight Gemini 2.5 for simple tasks", contextWindow: 1048576,
    capabilities: ["text", "code"],
    bestFor: "Simple tasks", costTier: "low",
  },
  {
    id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", providerId: "google", providerModelId: "gemini-2.0-flash",
    description: "Fast multimodal model for everyday tasks", contextWindow: 1048576,
    capabilities: ["text", "vision", "code", "tools"],
    bestFor: "Quick tasks", costTier: "low",
  },
  {
    id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", providerId: "google", providerModelId: "gemini-2.0-flash-lite",
    description: "Lightest Gemini for high-throughput tasks", contextWindow: 1048576,
    capabilities: ["text", "code"],
    bestFor: "Lightweight tasks", costTier: "low",
  },

  {
    id: "grok-3", name: "Grok 3", providerId: "xai", providerModelId: "grok-3",
    description: "Most capable Grok model", contextWindow: 131072,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Current events", costTier: "medium",
  },
  {
    id: "grok-3-fast", name: "Grok 3 Fast", providerId: "xai", providerModelId: "grok-3-fast",
    description: "Faster variant of Grok 3", contextWindow: 131072,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Quick reasoning", costTier: "medium",
  },
  {
    id: "grok-3-mini", name: "Grok 3 mini", providerId: "xai", providerModelId: "grok-3-mini",
    description: "Lightweight reasoning model from xAI", contextWindow: 131072,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Casual chat", costTier: "low",
  },
  {
    id: "grok-3-mini-fast", name: "Grok 3 mini Fast", providerId: "xai", providerModelId: "grok-3-mini-fast",
    description: "Fastest Grok model for quick responses", contextWindow: 131072,
    capabilities: ["text", "code"],
    bestFor: "Fast responses", costTier: "low",
  },

  {
    id: "fw-gpt-oss-120b", name: "GPT-OSS 120B", providerId: "fireworks",
    providerModelId: "accounts/fireworks/models/gpt-oss-120b",
    description: "OpenAI's open-source 120B on Fireworks", contextWindow: 131072,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Open-source flagship", costTier: "medium",
  },
  {
    id: "fw-llama-3.3-70b", name: "Llama 3.3 70B", providerId: "fireworks",
    providerModelId: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    description: "Meta's Llama 3.3 70B with fast inference", contextWindow: 131072,
    capabilities: ["text", "code", "tools"],
    bestFor: "Open-source general", costTier: "low",
  },
  {
    id: "fw-deepseek-v3", name: "DeepSeek V3", providerId: "fireworks",
    providerModelId: "accounts/fireworks/models/deepseek-v3p1",
    description: "Efficient MoE model with strong coding skills", contextWindow: 131072,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Code generation", costTier: "low",
  },
  {
    id: "fw-deepseek-v3-fast", name: "DeepSeek V3 (Fast)", providerId: "fireworks",
    providerModelId: "accounts/fireworks/models/deepseek-v3p2",
    description: "DeepSeek V3 on a fast inference partition", contextWindow: 131072,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Fast open-source", costTier: "low",
  },

  {
    id: "or-free-router", name: "OR Free Router", providerId: "openrouter", providerModelId: "openrouter/free",
    description: "Auto-routes to a random available free model — great for exploration", contextWindow: 200000,
    capabilities: ["text", "vision", "reasoning", "tools"],
    bestFor: "Exploration", costTier: "free",
  },
  {
    id: "or-gpt-oss-120b", name: "GPT-OSS 120B", providerId: "openrouter", providerModelId: "openai/gpt-oss-120b:free",
    description: "OpenAI's open-source 120B — free via OpenRouter", contextWindow: 131072,
    capabilities: ["text", "code", "tools"],
    bestFor: "Open-source flagship", costTier: "free",
  },
  {
    id: "or-gpt-oss-20b", name: "GPT-OSS 20B", providerId: "openrouter", providerModelId: "openai/gpt-oss-20b:free",
    description: "OpenAI's open-source 20B — free via OpenRouter", contextWindow: 131072,
    capabilities: ["text", "code"],
    bestFor: "Fast open-source", costTier: "free",
  },
  {
    id: "or-glm-4.5-air", name: "GLM 4.5 Air", providerId: "openrouter", providerModelId: "z-ai/glm-4.5-air:free",
    description: "Z.ai's GLM 4.5 Air — free via OpenRouter", contextWindow: 131072,
    capabilities: ["text", "code", "tools"],
    bestFor: "Multilingual", costTier: "free",
  },
  {
    id: "or-nemotron-super", name: "Nemotron 3 Super 120B", providerId: "openrouter",
    providerModelId: "nvidia/nemotron-3-super-120b-a12b:free",
    description: "NVIDIA's Nemotron 3 Super 120B — free, 1M context", contextWindow: 1000000,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Long reasoning", costTier: "free",
  },
  {
    id: "or-nemotron-nano-30b", name: "Nemotron Nano 30B", providerId: "openrouter",
    providerModelId: "nvidia/nemotron-3-nano-30b-a3b:free",
    description: "NVIDIA's Nemotron Nano 30B — free, efficient reasoning", contextWindow: 256000,
    capabilities: ["text", "code", "reasoning", "tools"],
    bestFor: "Efficient reasoning", costTier: "free",
  },
  {
    id: "or-nemotron-nano-12b-vl", name: "Nemotron Nano 12B VL", providerId: "openrouter",
    providerModelId: "nvidia/nemotron-nano-12b-v2-vl:free",
    description: "NVIDIA's Nemotron Nano 12B vision-language — free", contextWindow: 128000,
    capabilities: ["text", "vision", "code"],
    bestFor: "Vision tasks", costTier: "free",
  },
  {
    id: "or-nemotron-nano-9b", name: "Nemotron Nano 9B", providerId: "openrouter",
    providerModelId: "nvidia/nemotron-nano-9b-v2:free",
    description: "NVIDIA's Nemotron Nano 9B — free", contextWindow: 32000,
    capabilities: ["text", "code"],
    bestFor: "Fast inference", costTier: "free",
  },
  {
    id: "or-gemma-4-26b", name: "Gemma 4 26B", providerId: "openrouter",
    providerModelId: "google/gemma-4-26b-a4b-it:free",
    description: "Google's Gemma 4 26B A4B multimodal — free", contextWindow: 262144,
    capabilities: ["text", "vision", "code", "reasoning", "tools"],
    bestFor: "Efficient multimodal", costTier: "free", noSystemPrompt: true,
  },
  {
    id: "or-gemma-3-27b", name: "Gemma 3 27B", providerId: "openrouter",
    providerModelId: "google/gemma-3-27b-it:free",
    description: "Google's Gemma 3 27B — free", contextWindow: 131072,
    capabilities: ["text", "vision", "code"],
    bestFor: "Efficient tasks", costTier: "free", noSystemPrompt: true,
  },
  {
    id: "or-gemma-3-12b", name: "Gemma 3 12B", providerId: "openrouter",
    providerModelId: "google/gemma-3-12b-it:free",
    description: "Google's Gemma 3 12B — free", contextWindow: 131072,
    capabilities: ["text", "code"],
    bestFor: "Lightweight tasks", costTier: "free", noSystemPrompt: true,
  },
  {
    id: "or-gemma-3-4b", name: "Gemma 3 4B", providerId: "openrouter",
    providerModelId: "google/gemma-3-4b-it:free",
    description: "Google's Gemma 3 4B — free, very fast", contextWindow: 131072,
    capabilities: ["text", "code"],
    bestFor: "Fast tasks", costTier: "free", noSystemPrompt: true,
  },
  {
    id: "or-gemma-3n-4b", name: "Gemma 3n 4B", providerId: "openrouter",
    providerModelId: "google/gemma-3n-e4b-it:free",
    description: "Google's Gemma 3n 4B edge model — free", contextWindow: 32000,
    capabilities: ["text", "code"],
    bestFor: "Edge tasks", costTier: "free", noSystemPrompt: true,
  },
  {
    id: "or-gemma-3n-2b", name: "Gemma 3n 2B", providerId: "openrouter",
    providerModelId: "google/gemma-3n-e2b-it:free",
    description: "Google's tiny Gemma 3n 2B — free", contextWindow: 8192,
    capabilities: ["text"],
    bestFor: "Minimal tasks", costTier: "free", noSystemPrompt: true,
  },
  {
    id: "or-lfm-2.5-thinking", name: "LFM 2.5 Thinking", providerId: "openrouter",
    providerModelId: "liquid/lfm-2.5-1.2b-thinking:free",
    description: "LiquidAI's LFM 2.5 1.2B Thinking — free", contextWindow: 32768,
    capabilities: ["text", "reasoning", "tools"],
    bestFor: "Compact reasoning", costTier: "free",
  },
  {
    id: "or-lfm-2.5-instruct", name: "LFM 2.5 Instruct", providerId: "openrouter",
    providerModelId: "liquid/lfm-2.5-1.2b-instruct:free",
    description: "LiquidAI's LFM 2.5 1.2B Instruct — free", contextWindow: 32768,
    capabilities: ["text", "tools"],
    bestFor: "Quick tasks", costTier: "free",
  },

  {
    id: "dall-e-3", name: "DALL-E 3", providerId: "openai", providerModelId: "dall-e-3",
    description: "High-quality image generation from text prompts", contextWindow: 4000,
    capabilities: ["image-gen"],
    bestFor: "Image generation", costTier: "medium",
  },
  {
    id: "gpt-image-1", name: "GPT Image 1", providerId: "openai", providerModelId: "gpt-image-1",
    description: "OpenAI's latest image generation model", contextWindow: 32000,
    capabilities: ["image-gen"],
    bestFor: "Image generation", costTier: "medium",
  },
];

export const MODELS = models;
export const STATIC_MODELS = models;

export function getModel(id: string): Model | undefined {
  return models.find((m) => m.id === id);
}

export function getDefaultModel(): Model {
  return models.find((m) => m.isDefault) ?? models[0];
}

export function getModelsByProvider(providerId: string): Model[] {
  return models.filter((m) => m.providerId === providerId);
}

export const PROVIDERS: { id: string; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
  { id: "xai", label: "xAI" },
  { id: "fireworks", label: "Fireworks" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama" },
];

export const PROVIDER_LABEL: Record<string, string> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.label])
);
