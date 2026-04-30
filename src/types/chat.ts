export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "fireworks"
  | "openrouter"
  | "ollama"
  | "custom";

export type ModelCapability =
  | "text"
  | "vision"
  | "code"
  | "reasoning"
  | "tools"
  | "image-gen"
  | "audio";

export type CostTier = "free" | "low" | "medium" | "high";

export type Model = {
  id: string;
  name: string;
  providerId: ProviderId;
  providerModelId: string;
  capabilities: ModelCapability[];
  contextWindow?: number;
  description?: string;
  isDefault?: boolean;
  bestFor?: string;
  costTier?: CostTier;

  noSystemPrompt?: boolean;
};

export type ChatAttachment = {
  id: string;
  filename: string;
  mimeType: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId?: string | null;
  reasoning?: string | null;
  createdAt: string;
  attachments?: ChatAttachment[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  modelId: string;
  pinned: boolean;
  archived?: boolean;
  folderId?: string | null;
  updatedAt: string;
};
