import type { Tool } from "ai";
import type { Model } from "@/types/chat";
import type {
  ToolContext,
  ToolDefinition,
  ToolName,
  UserPrefsSlice,
} from "./types";
import { webSearchDefinition } from "./web-search";
import { urlReadDefinition } from "./url-read";
import { kbSearchDefinition } from "./kb-search";
import { codeExecDefinition } from "./code-exec";
import { imageGenDefinition } from "./image-gen";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  webSearchDefinition,
  urlReadDefinition,
  kbSearchDefinition,
  codeExecDefinition,
  imageGenDefinition,
];

export function buildToolsForRequest(params: {
  model: Model;
  userPrefs: UserPrefsSlice;
  context: ToolContext;
}): { tools: Record<string, Tool>; enabledNames: ToolName[] } {
  if (!params.model.capabilities.includes("tools")) {
    return { tools: {}, enabledNames: [] };
  }
  if (params.userPrefs.toolsEnabled === false) {
    return { tools: {}, enabledNames: [] };
  }
  const tools: Record<string, Tool> = {};
  const enabledNames: ToolName[] = [];
  for (const def of TOOL_DEFINITIONS) {
    if (!def.isEnabled({ model: params.model, userPrefs: params.userPrefs, ctx: params.context })) {
      continue;
    }
    tools[def.name] = def.build(params.context);
    enabledNames.push(def.name);
  }
  return { tools, enabledNames };
}

export function toolsSystemPromptHint(names: ToolName[]): string {
  if (names.length === 0) return "";
  const parts: string[] = [];
  parts.push("\n\n[tools available — strict usage rules:");
  if (names.includes("web_search")) {
    parts.push(
      "- web_search: call when the user asks about current events, live data (time, weather, scores, prices), recent news, or anything your training data may be outdated on. convert the question into a concise keyword query. cite sources inline as [1], [2], etc. call at most once per turn. never mention the tool name in your reply."
    );
  }
  if (names.includes("url_read")) {
    parts.push(
      "- url_read: call when the user pastes or references a specific URL and you need to read the page contents. only call once per unique URL per turn. summarize what you found rather than reproducing the whole page."
    );
  }
  if (names.includes("kb_search")) {
    parts.push(
      "- kb_search: call when the user's question is likely answered by their uploaded knowledge base documents. cite the source filename in your answer. call at most twice per turn."
    );
  }
  if (names.includes("code_exec")) {
    parts.push(
      "- code_exec: execute Python or JavaScript code when the user asks for calculations, data processing, algorithm verification, or any task better done by running code than reasoning alone. always print the final result. prefer python for math/data, javascript for js-specific tasks."
    );
  }
  if (names.includes("image_gen")) {
    parts.push(
      "- image_gen: generate an image when the user explicitly asks to create, draw, generate, or illustrate one. provide a detailed descriptive prompt. call at most once per turn."
    );
  }
  parts.push("]");
  return parts.join("\n");
}

export type { ToolContext, ToolDefinition, ToolName, UserPrefsSlice };
