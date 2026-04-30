import { db } from "@/lib/db";
import { resolveProviderKey } from "@/lib/providers/resolve-key";

const EMBED_MODEL = "text-embedding-3-small";
const EXTRACT_MODEL = "gpt-4o-mini";

const SIM_THRESHOLD = 0.32;
const MAX_RETRIEVED = 8;

const DEDUPE_THRESHOLD = 0.85;
const MAX_PER_EXTRACTION = 5;

const EXTRACT_SYSTEM_PROMPT = `You extract durable facts about the user from a chat conversation.

Return a JSON array of strings. Each string is one self-contained fact written in third person about the user (start with "User"). Only include facts that:
- Are likely true beyond this single conversation
- Are about the user themselves (preferences, role, projects, identity, ongoing work, important context)
- Are not derivable from public knowledge alone
- Are NOT temporary state ("user just asked X") or in-the-moment requests

Output strict JSON: an array of 0-${MAX_PER_EXTRACTION} short strings. No prose, no markdown, no keys, just the array.

Examples:
["User prefers TypeScript over JavaScript", "User is building a self-hosted AI chat app called OpenMLC", "User runs Linux as their daily driver"]

If no durable facts, return [].`;

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    nA = 0,
    nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  const mag = Math.sqrt(nA) * Math.sqrt(nB);
  return mag === 0 ? 0 : dot / mag;
}

export type MemoryRow = {
  id: string;
  text: string;
  source: string;
  pinned: boolean;
  active: boolean;
  embedding: string | null;
  createdAt: Date;
};

export async function searchMemories(
  profileId: string,
  query: string,
  k = MAX_RETRIEVED,
  opts?: { spaceId?: string | null },
): Promise<MemoryRow[]> {
  // [spaces] When in a space, include space-scoped memories + root memories.
  const spaceFilter = opts?.spaceId
    ? { OR: [{ spaceId: opts.spaceId }, { spaceId: null }] }
    : {};
  const all = await db.memory.findMany({
    where: { profileId, active: true, ...spaceFilter },
    select: {
      id: true,
      text: true,
      source: true,
      pinned: true,
      active: true,
      embedding: true,
      createdAt: true,
    },
  });
  if (all.length === 0) return [];

  const pinned = all.filter((m) => m.pinned);
  const unpinned = all.filter((m) => !m.pinned);

  if (unpinned.length === 0) return pinned.slice(0, k);

  const resolved = await resolveProviderKey(profileId, "openai");
  if (!resolved) return pinned.slice(0, k);

  let queryEmb: number[];
  try {
    queryEmb = await generateEmbedding(query, resolved.key);
  } catch {
    return pinned.slice(0, k);
  }

  const scored = unpinned
    .filter((m) => !!m.embedding)
    .map((m) => {
      try {
        const emb = JSON.parse(m.embedding!) as number[];
        return { row: m, score: cosineSimilarity(queryEmb, emb) };
      } catch {
        return { row: m, score: -1 };
      }
    })
    .filter((x) => x.score >= SIM_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, Math.max(0, k - pinned.length)).map((x) => x.row);
  return [...pinned, ...top];
}

export function formatMemoriesForPrompt(memories: MemoryRow[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.text}`).join("\n");
  return `<user_memory>
What you know about this user from prior conversations. Use this context naturally; do not announce that you are using stored memory.
${lines}
</user_memory>`;
}

export async function embedMemoryText(
  profileId: string,
  text: string,
): Promise<string | null> {
  const resolved = await resolveProviderKey(profileId, "openai");
  if (!resolved) return null;
  try {
    const emb = await generateEmbedding(text, resolved.key);
    return JSON.stringify(emb);
  } catch {
    return null;
  }
}

export async function createMemory(
  profileId: string,
  text: string,
  opts: {
    source?: "auto" | "manual";
    sourceConvId?: string | null;
    pinned?: boolean;
  } = {},
) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const embedding = await embedMemoryText(profileId, trimmed);
  return db.memory.create({
    data: {
      profileId,
      text: trimmed,
      source: opts.source ?? "manual",
      sourceConvId: opts.sourceConvId ?? null,
      pinned: opts.pinned ?? false,
      embedding,
    },
  });
}

export async function extractMemoriesFromConversation(
  conversationId: string,
  profileId: string,
): Promise<{ created: number; skipped: number }> {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { memoryAutoExtract: true },
  });
  if (!profile?.memoryAutoExtract) return { created: 0, skipped: 0 };

  const resolved = await resolveProviderKey(profileId, "openai");
  if (!resolved) return { created: 0, skipped: 0 };

  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { role: true, content: true },
  });
  if (messages.length < 2) return { created: 0, skipped: 0 };

  const transcript = messages
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role}: ${m.content.slice(0, 800)}`)
    .join("\n\n");

  let candidates: string[] = [];
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: resolved.key });
    const completion = await openai.chat.completions.create({
      model: EXTRACT_MODEL,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const raw = completion.choices[0]?.message?.content ?? "[]";
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      candidates = parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    } else if (parsed && typeof parsed === "object") {
      const arr = (parsed as Record<string, unknown>).memories ?? (parsed as Record<string, unknown>).facts;
      if (Array.isArray(arr)) {
        candidates = arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      }
    }
  } catch {
    return { created: 0, skipped: 0 };
  }

  candidates = candidates.slice(0, MAX_PER_EXTRACTION);
  if (candidates.length === 0) return { created: 0, skipped: 0 };

  const existing = await db.memory.findMany({
    where: { profileId, active: true },
    select: { id: true, text: true, embedding: true },
  });
  const existingEmbeddings: Array<{ text: string; emb: number[] | null }> = existing.map((e) => {
    if (!e.embedding) return { text: e.text, emb: null };
    try {
      return { text: e.text, emb: JSON.parse(e.embedding) as number[] };
    } catch {
      return { text: e.text, emb: null };
    }
  });

  let created = 0;
  let skipped = 0;
  for (const text of candidates) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (existingEmbeddings.some((e) => e.text.toLowerCase() === trimmed.toLowerCase())) {
      skipped++;
      continue;
    }
    let candEmb: number[] | null = null;
    try {
      candEmb = await generateEmbedding(trimmed, resolved.key);
    } catch {
      candEmb = null;
    }
    if (candEmb) {
      const isDup = existingEmbeddings.some(
        (e) => e.emb && cosineSimilarity(candEmb!, e.emb) > DEDUPE_THRESHOLD,
      );
      if (isDup) {
        skipped++;
        continue;
      }
    }
    await db.memory.create({
      data: {
        profileId,
        text: trimmed,
        source: "auto",
        sourceConvId: conversationId,
        embedding: candEmb ? JSON.stringify(candEmb) : null,
      },
    });
    existingEmbeddings.push({ text: trimmed, emb: candEmb });
    created++;
  }

  return { created, skipped };
}
