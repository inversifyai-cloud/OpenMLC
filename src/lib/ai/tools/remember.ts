import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createMemory } from "@/lib/ai/memory";

const inputSchema = z.object({
  fact: z
    .string()
    .min(3)
    .max(400)
    .describe(
      "A short, durable fact about the user written in third person, starting with 'User'. e.g. 'User prefers TypeScript over JavaScript' or 'User runs Linux as their daily driver'.",
    ),
  pinned: z
    .boolean()
    .optional()
    .describe(
      "Optional. Set to true ONLY if the fact is foundational identity info that should always be in context (name, role, primary tech stack). Defaults to false.",
    ),
});

export const rememberDefinition: ToolDefinition<"remember"> = {
  name: "remember",
  displayName: "Saved memory",
  verb: "Saving memory",
  isEnabled: ({ ctx }) => !!ctx.resolvedKeys.openai,
  build: (ctx) =>
    tool({
      description:
        "Save a durable fact about the user that should persist across conversations. Use this when the user shares preferences, projects, role, ongoing work, or important context that will be useful in future chats. Phrase the fact concisely in third person starting with 'User'. Do NOT save in-the-moment requests, temporary state, or facts that are not about the user themselves.",
      inputSchema,
      execute: async ({ fact, pinned }) => {
        try {
          const created = await createMemory(ctx.profileId, fact, {
            source: "auto",
            sourceConvId: ctx.conversationId,
            pinned: pinned ?? false,
          });
          if (!created) {
            return { success: false, error: "Memory could not be saved." };
          }
          return {
            success: true,
            memoryId: created.id,
            text: created.text,
            pinned: created.pinned,
          };
        } catch (err) {
          console.error("[tool:remember] failed", err);
          return { success: false, error: "Failed to save memory." };
        }
      },
    }),
};
