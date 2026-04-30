import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  kind: z
    .enum(["source", "note"])
    .describe(
      "Either 'source' (record a web source you intend to cite) or 'note' (record a working note or partial draft).",
    ),
  url: z.string().url().optional().describe("URL of the source (required when kind='source')."),
  title: z.string().max(300).optional().describe("Title of the source page."),
  snippet: z
    .string()
    .max(2000)
    .optional()
    .describe("A short relevant excerpt or summary from the source."),
  body: z
    .string()
    .max(8000)
    .optional()
    .describe("Free-form note text (used when kind='note')."),
});

type StoredSource = {
  idx: number;
  title?: string;
  url?: string;
  snippet?: string;
  fetchedAt: string;
};

type StoredNote = {
  body: string;
  createdAt: string;
};

export const researchNoteDefinition: ToolDefinition<"research_note"> = {
  name: "research_note",
  displayName: "Recorded research",
  verb: "Recording research",

  isEnabled: () => true,
  build: (ctx) =>
    tool({
      description:
        "Record a source or working note during deep research. Use kind='source' BEFORE relying on a web result — it returns a citation index [N] you must use in your final answer. Use kind='note' to stash partial findings or drafts. Outside of research mode this is a no-op.",
      inputSchema,
      execute: async ({ kind, url, title, snippet, body }) => {
        try {
          if (!ctx.conversationId) {
            return { ok: true, idx: 0, note: "no active research session" };
          }
          const session = await ctx.db.researchSession.findFirst({
            where: { conversationId: ctx.conversationId, status: "executing" },
            orderBy: { createdAt: "desc" },
          });
          if (!session) {
            return { ok: true, idx: 0, note: "no active research session" };
          }

          if (kind === "source") {
            let sources: StoredSource[] = [];
            try {
              const parsed = JSON.parse(session.sources);
              if (Array.isArray(parsed)) sources = parsed as StoredSource[];
            } catch {}
            const idx = sources.length + 1;
            const entry: StoredSource = {
              idx,
              title: title?.slice(0, 300),
              url,
              snippet: snippet?.slice(0, 2000),
              fetchedAt: new Date().toISOString(),
            };
            sources.push(entry);
            await ctx.db.researchSession.update({
              where: { id: session.id },
              data: { sources: JSON.stringify(sources) },
            });
            return { ok: true, idx, total: sources.length };
          }

          // kind === "note"
          let notes: StoredNote[] = [];
          try {
            const parsed = JSON.parse(session.notes);
            if (Array.isArray(parsed)) notes = parsed as StoredNote[];
          } catch {}
          notes.push({
            body: (body ?? "").slice(0, 8000),
            createdAt: new Date().toISOString(),
          });
          await ctx.db.researchSession.update({
            where: { id: session.id },
            data: { notes: JSON.stringify(notes) },
          });
          return { ok: true, idx: 0, noteCount: notes.length };
        } catch (err) {
          console.error("[tool:research_note] failed", err);
          return { ok: false, error: "research_note failed" };
        }
      },
    }),
};
