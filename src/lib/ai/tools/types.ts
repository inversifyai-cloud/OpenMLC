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
  | "remember"
  | "research_note"
  | "browser_navigate"
  | "browser_click"
  | "browser_type"
  | "browser_press"
  | "browser_scroll"
  | "browser_back"
  | "browser_forward"
  | "browser_extract"
  | "computer_screenshot"
  | "computer_click"
  | "computer_double_click"
  | "computer_move"
  | "computer_scroll"
  | "computer_drag"
  | "computer_type"
  | "computer_key"
  | "computer_bash"
  | "computer_file_read"
  | "computer_file_write"
  | "computer_file_list"
  | "computer_file_delete"
  | "computer_clipboard_read"
  | "computer_clipboard_write"
  | "computer_launch_app"
  | "computer_system_info";

export interface ToolContext {
  profileId: string;
  conversationId: string | null;
  db: typeof db;

  resolvedKeys: {
    openai?: string;
    tavily?: string;
  };
  sandboxEnabled?: boolean;
  computerAgentUrl?: string;
  computerAgentToken?: string;
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
