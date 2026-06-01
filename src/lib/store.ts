import type { Chunk, RetrievedSource } from "./types";
import { cosine } from "./embeddings";

/**
 * In-memory vector store keyed by channelId.
 * Survives within a single serverless instance only; on Vercel this means
 * embeddings live for the lifetime of the warm lambda. Good enough for v1 /
 * single-session demo. Swap for pgvector (DATABASE_URL) for persistence.
 */
const store = new Map<string, Chunk[]>();

export function saveChunks(channelId: string, chunks: Chunk[]) {
  store.set(channelId, chunks);
}

export function hasChannel(channelId: string): boolean {
  return store.has(channelId) && (store.get(channelId)?.length ?? 0) > 0;
}

export function channelChunkCount(channelId: string): number {
  return store.get(channelId)?.length ?? 0;
}

export function search(
  channelId: string,
  queryEmbedding: number[],
  topK = 6
): RetrievedSource[] {
  const chunks = store.get(channelId) || [];
  const scored = chunks
    .filter((c) => c.embedding)
    .map((c) => ({
      videoId: c.videoId,
      videoTitle: c.videoTitle,
      start: c.start,
      text: c.text,
      score: cosine(queryEmbedding, c.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
