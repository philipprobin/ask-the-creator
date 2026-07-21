import type {
  Chunk,
  RetrievedSource,
  EmbeddedChannel,
  EmbeddedVideo,
  ChatTurn,
  ScoredVideo,
} from "../types";
import type { SaveMeta, VideoMetaInput } from "../db";
import type { EmbedStatus, UsageAgg } from "./backend";
import { cosine } from "../embeddings";
import { joinTranscript, type JoinedTranscript } from "./join";

/**
 * Ephemeral in-process backend — data lives only for the Node process lifetime.
 * Used only when STORAGE_BACKEND=memory (tests/demo). Default self-host uses sqlite.
 */

const memChunks = new Map<string, Chunk[]>();
const memMeta = new Map<string, SaveMeta>();
const memChats = new Map<string, ChatTurn[]>();
const memVideoMeta = new Map<string, VideoMetaInput[]>();
const memStatus = new Map<string, EmbedStatus>();
const memUsage: { kind: string; model: string; promptTokens: number; completionTokens: number }[] = [];

export async function saveChunks(channelId: string, chunks: Chunk[], meta: SaveMeta): Promise<void> {
  memChunks.set(channelId, [...(memChunks.get(channelId) || []), ...chunks]);
  const prev = memMeta.get(channelId);
  memMeta.set(channelId, {
    channelTitle: meta.channelTitle,
    channelThumbnail: meta.channelThumbnail,
    videos: [...(prev?.videos || []), ...meta.videos],
  });
}

export async function hasChannel(channelId: string): Promise<boolean> {
  return (memChunks.get(channelId)?.length ?? 0) > 0;
}

export async function channelChunkCount(channelId: string): Promise<number> {
  return memChunks.get(channelId)?.length ?? 0;
}

export async function search(channelId: string, queryEmbedding: number[], topK = 6): Promise<RetrievedSource[]> {
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

export async function listVideosForChannel(channelId: string): Promise<EmbeddedVideo[]> {
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

export async function getEmbeddedVideoIds(channelId: string): Promise<Set<string>> {
  // Only videos that produced chunks — skipped videos stay eligible for retry.
  const chunks = memChunks.get(channelId) || [];
  return new Set(chunks.map((c) => c.videoId));
}

export async function saveChatTurn(channelId: string, turn: ChatTurn): Promise<void> {
  memChats.set(channelId, [...(memChats.get(channelId) || []), turn]);
}

export async function getChatHistory(channelId: string): Promise<ChatTurn[]> {
  return memChats.get(channelId) || [];
}

export async function getMetaVideoIds(channelId: string): Promise<Set<string>> {
  return new Set((memVideoMeta.get(channelId) || []).map((v) => v.id));
}

export async function isChannelMetaIndexed(channelId: string): Promise<boolean> {
  return (memVideoMeta.get(channelId)?.length ?? 0) > 0;
}

export async function saveVideoMeta(
  channelId: string,
  _meta: { channelTitle: string; channelThumbnail?: string },
  rows: VideoMetaInput[]
): Promise<void> {
  const existing = memVideoMeta.get(channelId) || [];
  const byId = new Map(existing.map((v) => [v.id, v]));
  for (const r of rows) byId.set(r.id, r);
  memVideoMeta.set(channelId, [...byId.values()]);
}

export async function scoreVideos(channelId: string, queryEmbedding: number[], limit = 200): Promise<ScoredVideo[]> {
  const rows = memVideoMeta.get(channelId) || [];
  return rows
    .map((v) => ({
      videoId: v.id,
      source: "youtube" as const,
      title: v.title,
      description: v.description,
      thumbnail: v.thumbnail,
      duration: v.duration,
      publishedAt: v.publishedAt,
      viewCount: v.viewCount,
      isShort: v.isShort,
      score: Math.max(0, Math.min(100, Math.round(cosine(queryEmbedding, v.embedding) * 100))),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getVideoMetaForIds(
  channelId: string,
  ids: string[]
): Promise<{ videoId: string; title: string; thumbnail?: string }[]> {
  const idSet = new Set(ids);
  return (memVideoMeta.get(channelId) || [])
    .filter((v) => idSet.has(v.id))
    .map((v) => ({ videoId: v.id, title: v.title, thumbnail: v.thumbnail }));
}

export async function setEmbedStatus(channelId: string, processed: number, total: number, done: boolean): Promise<void> {
  memStatus.set(channelId, { processed, total, done });
}

export async function getEmbedStatus(channelId: string): Promise<EmbedStatus> {
  return memStatus.get(channelId) || { processed: 0, total: 0, done: false };
}

export async function loadChannelTranscript(channelId: string): Promise<JoinedTranscript> {
  const chunks = [...(memChunks.get(channelId) || [])].sort(
    (a, b) => (a.videoId < b.videoId ? -1 : a.videoId > b.videoId ? 1 : a.start - b.start)
  );
  return joinTranscript(
    chunks.map((c) => ({ video_id: c.videoId, video_title: c.videoTitle, chunk_text: c.text }))
  );
}

export async function recordUsage(kind: string, model: string, promptTokens: number, completionTokens: number): Promise<void> {
  memUsage.push({ kind, model, promptTokens: promptTokens | 0, completionTokens: completionTokens | 0 });
}

export async function getUsage(): Promise<UsageAgg> {
  const agg = new Map<string, { kind: string; model: string; promptTokens: number; completionTokens: number; requests: number }>();
  for (const u of memUsage) {
    const key = `${u.kind}|${u.model}`;
    const cur = agg.get(key) || { kind: u.kind, model: u.model, promptTokens: 0, completionTokens: 0, requests: 0 };
    cur.promptTokens += u.promptTokens;
    cur.completionTokens += u.completionTokens;
    cur.requests += 1;
    agg.set(key, cur);
  }
  return { rows: [...agg.values()] };
}
