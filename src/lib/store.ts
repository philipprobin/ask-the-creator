import type { Chunk, RetrievedSource } from "./types";
import { cosine } from "./embeddings";
import { hasDatabase } from "./config";

/**
 * Unified store interface that switches between in-memory and Postgres
 * based on DATABASE_URL availability.
 */

// In-memory fallback (same as before)
const memStore = new Map<string, Chunk[]>();

export async function saveChunks(channelId: string, chunks: Chunk[]) {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.saveChunks(channelId, chunks);
  }
  memStore.set(channelId, chunks);
}

export async function hasChannel(channelId: string): Promise<boolean> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.hasChannel(channelId);
  }
  return memStore.has(channelId) && (memStore.get(channelId)?.length ?? 0) > 0;
}

export async function channelChunkCount(channelId: string): Promise<number> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.channelChunkCount(channelId);
  }
  return memStore.get(channelId)?.length ?? 0;
}

export async function search(
  channelId: string,
  queryEmbedding: number[],
  topK = 6
): Promise<RetrievedSource[]> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.search(channelId, queryEmbedding, topK);
  }

  // In-memory fallback
  const chunks = memStore.get(channelId) || [];
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
