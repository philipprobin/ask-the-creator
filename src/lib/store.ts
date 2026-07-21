import type { Chunk, RetrievedSource, EmbeddedChannel, EmbeddedVideo, ChatTurn, ScoredVideo } from "./types";
import type { SaveMeta, VideoMetaInput } from "./db";
import type { StoreBackend, EmbedStatus } from "./store/backend";
import { config } from "./config";

/**
 * Unified store facade. Selects a backend once based on `config.storageBackend`:
 *  - "pgvector" (DATABASE_URL set) — Postgres + pgvector (hosted/cloud)
 *  - "sqlite"   (default)          — local better-sqlite3 file, zero setup
 *  - "memory"   (opt-in)           — ephemeral, tests/demo
 * Backends are lazy-loaded so native/driver deps only load on their own path.
 */
let backendPromise: Promise<StoreBackend> | null = null;

function getBackend(): Promise<StoreBackend> {
  if (!backendPromise) {
    switch (config.storageBackend) {
      case "pgvector":
        backendPromise = import("./db") as unknown as Promise<StoreBackend>;
        break;
      case "memory":
        backendPromise = import("./store/memory") as unknown as Promise<StoreBackend>;
        break;
      default:
        backendPromise = import("./store/sqlite") as unknown as Promise<StoreBackend>;
    }
  }
  return backendPromise;
}

export async function saveChunks(channelId: string, chunks: Chunk[], meta: SaveMeta): Promise<void> {
  return (await getBackend()).saveChunks(channelId, chunks, meta);
}
export async function hasChannel(channelId: string): Promise<boolean> {
  return (await getBackend()).hasChannel(channelId);
}
export async function channelChunkCount(channelId: string): Promise<number> {
  return (await getBackend()).channelChunkCount(channelId);
}
export async function search(channelId: string, queryEmbedding: number[], topK = 6): Promise<RetrievedSource[]> {
  return (await getBackend()).search(channelId, queryEmbedding, topK);
}
export async function listChannels(): Promise<EmbeddedChannel[]> {
  return (await getBackend()).listChannels();
}
export async function listVideosForChannel(channelId: string): Promise<EmbeddedVideo[]> {
  return (await getBackend()).listVideosForChannel(channelId);
}
export async function getEmbeddedVideoIds(channelId: string): Promise<Set<string>> {
  return (await getBackend()).getEmbeddedVideoIds(channelId);
}
export async function saveChatTurn(channelId: string, turn: ChatTurn): Promise<void> {
  return (await getBackend()).saveChatTurn(channelId, turn);
}
export async function getChatHistory(channelId: string): Promise<ChatTurn[]> {
  return (await getBackend()).getChatHistory(channelId);
}
export async function getMetaVideoIds(channelId: string): Promise<Set<string>> {
  return (await getBackend()).getMetaVideoIds(channelId);
}
export async function isChannelMetaIndexed(channelId: string): Promise<boolean> {
  return (await getBackend()).isChannelMetaIndexed(channelId);
}
export async function saveVideoMeta(
  channelId: string,
  meta: { channelTitle: string; channelThumbnail?: string },
  rows: VideoMetaInput[]
): Promise<void> {
  return (await getBackend()).saveVideoMeta(channelId, meta, rows);
}
export async function scoreVideos(channelId: string, queryEmbedding: number[], limit = 200): Promise<ScoredVideo[]> {
  return (await getBackend()).scoreVideos(channelId, queryEmbedding, limit);
}
export async function getVideoMetaForIds(
  channelId: string,
  ids: string[]
): Promise<{ videoId: string; title: string; thumbnail?: string }[]> {
  return (await getBackend()).getVideoMetaForIds(channelId, ids);
}
export async function setEmbedStatus(channelId: string, processed: number, total: number, done: boolean): Promise<void> {
  return (await getBackend()).setEmbedStatus(channelId, processed, total, done);
}
export async function getEmbedStatus(channelId: string): Promise<EmbedStatus> {
  return (await getBackend()).getEmbedStatus(channelId);
}
export async function loadChannelTranscript(channelId: string): Promise<{ text: string; videoCount: number }> {
  return (await getBackend()).loadChannelTranscript(channelId);
}
