import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  prompt: z.string().max(2000).describe("A detailed description of the image to generate."),
});

export const imageGenDefinition: ToolDefinition<"image_gen"> = {
  name: "image_gen",
  displayName: "Generated image",
  verb: "Generating image",
  isEnabled: ({ ctx }) => !!ctx.resolvedKeys.openai,
  build: (ctx) =>
    tool({
      description:
        "Generate an image from a text prompt using OpenAI gpt-image-1. Use when the user explicitly asks to create, draw, generate, or illustrate an image. Provide a detailed, descriptive prompt for best results.",
      inputSchema,
      execute: async ({ prompt }) => {
        const apiKey = ctx.resolvedKeys.openai;
        if (!apiKey) throw new Error("No OpenAI API key configured");

        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: prompt.slice(0, 2000),
            n: 1,
            size: "1024x1024",
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: { message?: string } }).error?.message ?? "Image generation failed"
          );
        }

        const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
        const item = data.data?.[0];
        if (!item) throw new Error("No image returned from API");

        const url = item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
        if (!url) throw new Error("No image URL returned from API");

        return { url, prompt, model: "gpt-image-1" };
      },
    }),
};

