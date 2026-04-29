import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { tavilySearch } from "@/lib/search";

const inputSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(300)
    .describe(
      "A concise web search query. Use keywords, not full sentences. " +
        "Example: 'current time Spain' instead of 'What is the current time in Spain?'",
    ),
});

export const webSearchDefinition: ToolDefinition<"web_search"> = {
  name: "web_search",
  displayName: "Searched the web",
  verb: "Searching the web",

  isEnabled: ({ ctx }) => !!ctx.resolvedKeys.tavily,
  build: (ctx) =>
    tool({
      description:
        "Search the web for current information. Call when the user asks about current events, live data (time, weather, scores, prices), recent news, or anything your training data may be outdated on. Cite sources inline using [1], [2], etc. Call at most once per turn.",
      inputSchema,
      execute: async ({ query }) => {
        try {
          const results = await tavilySearch(query, ctx.resolvedKeys.tavily);
          if (!results) return { query, success: false, error: "No results." };
          return { query, success: true, results };
        } catch (err) {
          console.error("[tool:web_search] failed", err);
          return { query, success: false, error: "Web search failed." };
        }
      },
    }),
};
