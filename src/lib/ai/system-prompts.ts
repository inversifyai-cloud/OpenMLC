export const BASE_SYSTEM_PROMPT = `you are running inside openmlc — a self-hosted, byok ai chat client. the operator brought their own keys and their conversations stay on their machine. be useful, precise, quiet. answer the question. avoid hype, filler, and unnecessary preamble.`;

export function getCurrentDateContext(): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `\n\nthe current date is ${date}.`;
}

export function composeSystemPrompt(opts: {
  conversationPrompt?: string | null;
  personaPrompt?: string | null;
  memoryBlock?: string | null;
} = {}): string {
  let out = BASE_SYSTEM_PROMPT + getCurrentDateContext();
  if (opts.personaPrompt) {
    out += `\n\n${opts.personaPrompt}`;
  }
  if (opts.conversationPrompt) {
    out += `\n\n${opts.conversationPrompt}`;
  }
  if (opts.memoryBlock) {
    out += `\n\n${opts.memoryBlock}`;
  }
  return out;
}
