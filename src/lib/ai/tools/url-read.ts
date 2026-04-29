import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { fetchUrlContent } from "@/lib/url-reader";

const inputSchema = z.object({
  url: z.string().url().describe("Absolute http(s) URL to fetch and read"),
});

export const urlReadDefinition: ToolDefinition<"url_read"> = {
  name: "url_read",
  displayName: "Read URL",
  verb: "Reading the page",

  isEnabled: () => true,
  build: () =>
    tool({
      description:
        "Fetch and read a webpage. Call when the user pastes a URL or asks about content at a specific URL. Returns the page's title and main text content. Summarize what you found rather than reproducing the page. Don't call more than once per unique URL.",
      inputSchema,
      execute: async ({ url }) => {
        const result = await fetchUrlContent(url);
        if (!result) {
          return { url, success: false, error: "Could not fetch or parse URL." };
        }
        return { url, success: true, ...result };
      },
    }),
};
