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
import { rememberDefinition } from "./remember";
import { researchNoteDefinition } from "./research-note";
import { browserDefinitions } from "./browser";
import { db } from "@/lib/db";
import { getConnector } from "@/lib/connectors";
import { refreshIfExpired } from "@/lib/connectors/refresh";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  webSearchDefinition,
  urlReadDefinition,
  kbSearchDefinition,
  codeExecDefinition,
  imageGenDefinition,
  rememberDefinition,
  researchNoteDefinition,
  ...browserDefinitions,
];

export async function buildToolsForRequest(params: {
  model: Model;
  userPrefs: UserPrefsSlice;
  context: ToolContext;
}): Promise<{ tools: Record<string, Tool>; enabledNames: ToolName[]; connectorProviders: string[] }> {
  if (!params.model.capabilities.includes("tools")) {
    return { tools: {}, enabledNames: [], connectorProviders: [] };
  }
  if (params.userPrefs.toolsEnabled === false) {
    return { tools: {}, enabledNames: [], connectorProviders: [] };
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

  // Load enabled OAuth connector tools for this profile.
  const connectorProviders: string[] = [];
  try {
    const connectorRows = await db.connector.findMany({
      where: {
        profileId: params.context.profileId,
        enabled: true,
        encryptedAccess: { not: null },
      },
    });
    for (const row of connectorRows) {
      const conn = getConnector(row.provider);
      if (!conn) continue;
      try {
        const { accessToken } = await refreshIfExpired(row);
        const builtTools = conn.buildTools({ profileId: params.context.profileId }, accessToken);
        Object.assign(tools, builtTools);
        connectorProviders.push(row.provider);
      } catch (err) {
        console.error(`[tools] connector ${row.provider} failed to build`, err);
      }
    }
  } catch (err) {
    console.error("[tools] failed to load connectors", err);
  }

  return { tools, enabledNames, connectorProviders };
}

export function toolsSystemPromptHint(names: ToolName[], connectorProviders: string[] = []): string {
  if (names.length === 0 && connectorProviders.length === 0) return "";
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
  if (names.includes("remember")) {
    parts.push(
      "- remember: save a durable fact about the user (preferences, role, tech stack, ongoing projects, important context) so it persists across conversations. call this whenever the user shares something worth knowing in future chats - their name, preferred languages, what they're building, etc. phrase the fact concisely in third person starting with 'User'. do NOT save in-the-moment requests, transient state, or speculation. do NOT mention saving the memory in your reply unless the user explicitly asks you to remember something."
    );
  }
  if (names.includes("research_note")) {
    parts.push(
      "- research_note: only useful in research mode. call kind='source' for each web result you intend to cite — it returns the citation index [N]. call kind='note' to record partial findings or drafts. outside of research mode this is a no-op; do not call it."
    );
  }
  if (connectorProviders.length > 0) {
    parts.push(
      `- connectors: you have these external accounts connected: ${connectorProviders.join(", ")}. use the matching tools (e.g. github_*, gmail_*) to read or act in the user's accounts. never send, create, or modify content without confirming intent with the user first.`,
    );
  }
  parts.push("]");
  return parts.join("\n");
}

export type { ToolContext, ToolDefinition, ToolName, UserPrefsSlice };
