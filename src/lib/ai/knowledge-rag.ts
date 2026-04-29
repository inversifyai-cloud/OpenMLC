import { db } from "@/lib/db";
import { resolveProviderKey } from "@/lib/providers/resolve-key";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS_PER_FILE = 100;
const TOP_K_RESULTS = 5;

export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      const lastParagraph = text.lastIndexOf("\n\n", end);
      const lastSentence = text.lastIndexOf(". ", end);
      const lastNewline = text.lastIndexOf("\n", end);

      if (lastParagraph > start + chunkSize / 2) {
        end = lastParagraph + 2;
      } else if (lastSentence > start + chunkSize / 2) {
        end = lastSentence + 2;
      } else if (lastNewline > start + chunkSize / 2) {
        end = lastNewline + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;

    if (chunks.length >= MAX_CHUNKS_PER_FILE) break;
  }

  return chunks.filter((c) => c.length > 20);
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export async function processKnowledgeFile(
  fileId: string,
  profileId: string,
): Promise<{ chunksCreated: number; error?: string }> {
  const file = await db.knowledgeFile.findUnique({
    where: { id: fileId },
    select: { id: true, content: true, filename: true, profileId: true },
  });

  if (!file || !file.content) {
    return { chunksCreated: 0, error: "File not found or has no content" };
  }
  if (file.profileId !== profileId) {
    return { chunksCreated: 0, error: "Forbidden" };
  }

  const resolved = await resolveProviderKey(profileId, "openai");
  if (!resolved) {
    await db.knowledgeFile.update({
      where: { id: fileId },
      data: { embeddingStatus: "failed" },
    });
    return { chunksCreated: 0, error: "OpenAI API key required for embeddings" };
  }

  await db.knowledgeFile.update({
    where: { id: fileId },
    data: { embeddingStatus: "processing" },
  });

  try {
    await db.knowledgeChunk.deleteMany({ where: { knowledgeFileId: fileId } });

    const chunks = chunkText(file.content);

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i], resolved.key);
      await db.knowledgeChunk.create({
        data: {
          knowledgeFileId: fileId,
          chunkIndex: i,
          content: chunks[i],
          embedding: JSON.stringify(embedding),
          tokenCount: Math.ceil(chunks[i].length / 4),
          metadata: JSON.stringify({
            filename: file.filename,
            chunkIndex: i,
            totalChunks: chunks.length,
          }),
        },
      });
    }

    await db.knowledgeFile.update({
      where: { id: fileId },
      data: { embeddingStatus: "completed" },
    });

    return { chunksCreated: chunks.length };
  } catch (error) {
    await db.knowledgeFile.update({
      where: { id: fileId },
      data: { embeddingStatus: "failed" },
    });
    return {
      chunksCreated: 0,
      error: error instanceof Error ? error.message : "Embedding generation failed",
    };
  }
}

export async function searchKnowledgeBase(
  profileId: string,
  query: string,
  options?: { topK?: number },
): Promise<Array<{ content: string; filename: string; similarity: number }>> {
  const topK = options?.topK ?? TOP_K_RESULTS;

  const chunks = await db.knowledgeChunk.findMany({
    where: {
      knowledgeFile: {
        profileId,
        active: true,
        embeddingStatus: "completed",
      },
      embedding: { not: null },
    },
    select: {
      content: true,
      embedding: true,
      knowledgeFile: { select: { filename: true } },
    },
  });

  if (chunks.length === 0) return [];

  const resolved = await resolveProviderKey(profileId, "openai");
  if (!resolved) return [];

  const queryEmbedding = await generateEmbedding(query, resolved.key);

  const scored = chunks.map((chunk) => {
    const chunkEmbedding: number[] = JSON.parse(chunk.embedding!);
    const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
    return {
      content: chunk.content,
      filename: chunk.knowledgeFile.filename,
      similarity,
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK).filter((s) => s.similarity > 0.3);
}

export async function buildRAGContext(
  profileId: string,
  query: string,
  options?: { maxChars?: number },
): Promise<string | null> {
  const results = await searchKnowledgeBase(profileId, query, { topK: 5 });
  if (results.length === 0) return null;

  const maxChars = options?.maxChars ?? 6000;
  let context = "";

  for (const result of results) {
    const section = `[From ${result.filename} (relevance: ${(result.similarity * 100).toFixed(0)}%)]:\n${result.content}\n\n`;
    if (context.length + section.length > maxChars) break;
    context += section;
  }

  return context.trim() || null;
}

export function triggerFileProcessing(fileId: string, profileId: string): void {
  processKnowledgeFile(fileId, profileId).catch((err) => {
    console.error(`[RAG] Failed to process file ${fileId}:`, err);
  });
}
