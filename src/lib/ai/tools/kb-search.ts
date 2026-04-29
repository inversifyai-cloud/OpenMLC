import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { searchKnowledgeBase } from "@/lib/ai/knowledge-rag";

const inputSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(500)
    .describe(
      "Search query for the user's uploaded knowledge base documents. Use natural language.",
    ),
});

export const kbSearchDefinition: ToolDefinition<"kb_search"> = {
  name: "kb_search",
  displayName: "Searched knowledge base",
  verb: "Searching knowledge base",
  // Only enable if the user opted in AND has an OpenAI key (needed for embeddings).
  isEnabled: ({ userPrefs, ctx }) =>
    userPrefs.knowledgeBaseEnabled && !!ctx.resolvedKeys.openai,
  build: (ctx) =>
    tool({
      description:
        "Search the user's uploaded knowledge base documents using semantic similarity. Returns the top relevant chunks with the source filename. Cite the source filename when using results. Call at most twice per turn.",
      inputSchema,
      execute: async ({ query }) => {
        try {
          const results = await searchKnowledgeBase(ctx.profileId, query, {
            topK: 5,
          });
          if (results.length === 0) {
            return {
              query,
              success: true,
              results: [],
              message: "No relevant documents found in knowledge base.",
            };
          }
          return {
            query,
            success: true,
            results: results.map((r) => ({
              filename: r.filename,
              relevance: Math.round(r.similarity * 100),
              content: r.content,
            })),
          };
        } catch (err) {
          console.error("[tool:kb_search] failed", err);
          return { query, success: false, error: "Knowledge base search failed." };
        }
      },
    }),
};
