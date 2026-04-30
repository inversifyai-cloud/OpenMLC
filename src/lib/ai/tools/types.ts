import type { Tool } from "ai";
import type { Model } from "@/types/chat";
import { db } from "@/lib/db";

export type ToolName =
  | "web_search"
  | "url_read"
  | "kb_search"
  | "code_exec"
  | "generate_image"
  | "image_gen"
  | "remember";

export interface ToolContext {
  profileId: string;
  conversationId: string | null;
  db: typeof db;

  resolvedKeys: {
    openai?: string;
    tavily?: string;
  };
  sandboxEnabled?: boolean;
}

export interface UserPrefsSlice {
  toolsEnabled: boolean;
  webSearchEnabled: boolean;
  knowledgeBaseEnabled: boolean;
}

export interface ToolDefinition<TName extends ToolName = ToolName> {
  name: TName;
  displayName: string;
  verb: string;
  isEnabled: (input: { model: Model; userPrefs: UserPrefsSlice; ctx: ToolContext }) => boolean;
  build: (ctx: ToolContext) => Tool;
}
