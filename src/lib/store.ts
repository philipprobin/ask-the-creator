import type {
  Chunk,
  RetrievedSource,
  EmbeddedChannel,
  EmbeddedVideo,
  ChatTurn,
} from "./types";
import { cosine } from "./embeddings";
import { hasDatabase } from "./config";
import type { SaveMeta } from "./db";

/**
 * Unified store: Postgres (pgvector) when DATABASE_URL is set, else in-memory.
 */

// In-memory fallbacks
const memChunks = new Map<string, Chunk[]>();
const memMeta = new Map<string, SaveMeta>();
const memChats = new Map<string, ChatTurn[]>();

export async function saveChunks(
  channelId: string,
  chunks: Chunk[],
  meta: SaveMeta
) {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.saveChunks(channelId, chunks, meta);
  }
  // In-memory: append (incremental)
  const existing = memChunks.get(channelId) || [];
  memChunks.set(channelId, [...existing, ...chunks]);
  const prevMeta = memMeta.get(channelId);
  memMeta.set(channelId, {
    channelTitle: meta.channelTitle,
    channelThumbnail: meta.channelThumbnail,
    videos: [...(prevMeta?.videos || []), ...meta.videos],
  });
}

export async function hasChannel(channelId: string): Promise<boolean> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.hasChannel(channelId);
  }
  return (memChunks.get(channelId)?.length ?? 0) > 0;
}

export async function channelChunkCount(channelId: string): Promise<number> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.channelChunkCount(channelId);
  }
  return memChunks.get(channelId)?.length ?? 0;
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
  const chunks = memChunks.get(channelId) || [];
  return chunks
    .filter((c) => c.embedding)
    .map((c) => ({
      videoId: c.videoId,
      videoTitle: c.videoTitle,
      start: c.start,
      text: c.text,
      score: cosine(queryEmbedding, c.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function listChannels(): Promise<EmbeddedChannel[]> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.listChannels();
  }
  return [...memMeta.entries()].map(([channelId, meta]) => {
    const chunks = memChunks.get(channelId) || [];
    const videoIds = new Set(chunks.map((c) => c.videoId));
    return {
      channelId,
      title: meta.channelTitle,
      thumbnail: meta.channelThumbnail,
      videoCount: videoIds.size,
      chunkCount: chunks.length,
      lastEmbeddedAt: new Date().toISOString(),
    };
  });
}

export async function listVideosForChannel(
  channelId: string
): Promise<EmbeddedVideo[]> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.listVideosForChannel(channelId);
  }
  const meta = memMeta.get(channelId);
  const chunks = memChunks.get(channelId) || [];
  const counts = new Map<string, number>();
  chunks.forEach((c) => counts.set(c.videoId, (counts.get(c.videoId) || 0) + 1));
  return (meta?.videos || []).map((v) => ({
    videoId: v.videoId,
    title: v.title,
    thumbnail: v.thumbnail,
    chunkCount: counts.get(v.videoId) || 0,
    embeddedAt: new Date().toISOString(),
  }));
}

export async function getEmbeddedVideoIds(
  channelId: string
): Promise<Set<string>> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.getEmbeddedVideoIds(channelId);
  }
  const meta = memMeta.get(channelId);
  return new Set((meta?.videos || []).map((v) => v.videoId));
}

export async function saveChatTurn(
  channelId: string,
  turn: ChatTurn
): Promise<void> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.saveChatTurn(channelId, turn);
  }
  const existing = memChats.get(channelId) || [];
  memChats.set(channelId, [...existing, turn]);
}

export async function getChatHistory(channelId: string): Promise<ChatTurn[]> {
  if (hasDatabase()) {
    const db = await import("./db");
    return db.getChatHistory(channelId);
  }
  return memChats.get(channelId) || [];
}
