import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type {
  Chunk,
  RetrievedSource,
  EmbeddedChannel,
  EmbeddedVideo,
  ChatTurn,
  ScoredVideo,
} from "../types";
import type { SaveMeta, VideoMetaInput } from "../db";
import { config } from "../config";
import { cosine } from "../embeddings";
import { joinTranscript, type JoinedTranscript } from "./join";
import type { UsageAgg } from "./backend";

/**
 * Local, zero-setup persistent backend (better-sqlite3). Mirrors the Postgres
 * backend's function surface so `store.ts` can delegate to either. Vector search
 * is done in JS (no pgvector) — fine for the local single-creator use case; the
 * default answer path (LLM-only, full-transcript stuffing) doesn't call it at all.
 *
 * NOTE: only imported when the sqlite backend is selected, so `better-sqlite3`
 * (a native module) never loads on the Postgres/serverless path.
 */

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const file = path.resolve(config.sqlitePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      channel_id TEXT PRIMARY KEY, title TEXT, thumbnail TEXT,
      last_embedded_at TEXT, meta_indexed_at TEXT, meta_video_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT, video_id TEXT,
      video_title TEXT, chunk_text TEXT, chunk_start REAL, embedding TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_emb_channel ON embeddings(channel_id);
    CREATE TABLE IF NOT EXISTS videos (
      channel_id TEXT, video_id TEXT, title TEXT, thumbnail TEXT,
      chunk_count INTEGER, has_transcript INTEGER, embedded_at TEXT,
      PRIMARY KEY (channel_id, video_id)
    );
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT, role TEXT,
      content TEXT, sources TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chats_channel ON chats(channel_id);
    CREATE TABLE IF NOT EXISTS video_meta (
      channel_id TEXT, video_id TEXT, source TEXT, title TEXT, description TEXT,
      thumbnail TEXT, duration TEXT, published_at TEXT, view_count INTEGER,
      is_short INTEGER, embedding TEXT,
      PRIMARY KEY (channel_id, video_id)
    );
    CREATE TABLE IF NOT EXISTS embed_progress (
      channel_id TEXT PRIMARY KEY, processed INTEGER, total INTEGER,
      done INTEGER, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, model TEXT,
      prompt_tokens INTEGER, completion_tokens INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

const now = () => new Date().toISOString();

export async function saveChunks(channelId: string, chunks: Chunk[], meta: SaveMeta): Promise<void> {
  const d = getDb();
  const tx = d.transaction(() => {
    d.prepare(
      `INSERT INTO channels (channel_id, title, thumbnail, last_embedded_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         title = excluded.title,
         thumbnail = COALESCE(excluded.thumbnail, channels.thumbnail),
         last_embedded_at = excluded.last_embedded_at`
    ).run(channelId, meta.channelTitle, meta.channelThumbnail || null, now());

    const insChunk = d.prepare(
      `INSERT INTO embeddings (channel_id, video_id, video_title, chunk_text, chunk_start, embedding)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const counts = new Map<string, number>();
    for (const c of chunks) {
      if (!c.embedding) continue;
      insChunk.run(channelId, c.videoId, c.videoTitle, c.text, c.start, JSON.stringify(c.embedding));
      counts.set(c.videoId, (counts.get(c.videoId) || 0) + 1);
    }

    const insVideo = d.prepare(
      `INSERT INTO videos (channel_id, video_id, title, thumbnail, chunk_count, has_transcript, embedded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_id, video_id) DO UPDATE SET
         title = excluded.title,
         thumbnail = COALESCE(excluded.thumbnail, videos.thumbnail),
         chunk_count = excluded.chunk_count,
         has_transcript = excluded.has_transcript,
         embedded_at = excluded.embedded_at`
    );
    for (const v of meta.videos) {
      const cc = counts.get(v.videoId) || 0;
      insVideo.run(channelId, v.videoId, v.title, v.thumbnail || null, cc, cc > 0 ? 1 : 0, now());
    }
  });
  tx();
}

export async function hasChannel(channelId: string): Promise<boolean> {
  const row = getDb().prepare("SELECT 1 FROM embeddings WHERE channel_id = ? LIMIT 1").get(channelId);
  return !!row;
}

export async function channelChunkCount(channelId: string): Promise<number> {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM embeddings WHERE channel_id = ?")
    .get(channelId) as { n: number };
  return row?.n ?? 0;
}

export async function search(channelId: string, queryEmbedding: number[], topK = 6): Promise<RetrievedSource[]> {
  const rows = getDb()
    .prepare("SELECT video_id, video_title, chunk_start, chunk_text, embedding FROM embeddings WHERE channel_id = ?")
    .all(channelId) as { video_id: string; video_title: string; chunk_start: number; chunk_text: string; embedding: string }[];
  return rows
    .map((r) => ({
      videoId: r.video_id,
      videoTitle: r.video_title,
      start: r.chunk_start,
      text: r.chunk_text,
      score: cosine(queryEmbedding, JSON.parse(r.embedding)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function listChannels(): Promise<EmbeddedChannel[]> {
  const rows = getDb()
    .prepare(
      `SELECT c.channel_id, c.title, c.thumbnail, c.last_embedded_at,
              COUNT(DISTINCT v.video_id) AS video_count,
              COALESCE(SUM(v.chunk_count), 0) AS chunk_count
       FROM channels c LEFT JOIN videos v ON v.channel_id = c.channel_id
       GROUP BY c.channel_id ORDER BY c.last_embedded_at DESC`
    )
    .all() as any[];
  return rows.map((r) => ({
    channelId: r.channel_id,
    title: r.title,
    thumbnail: r.thumbnail || undefined,
    videoCount: r.video_count,
    chunkCount: r.chunk_count,
    lastEmbeddedAt: r.last_embedded_at,
  }));
}

export async function listVideosForChannel(channelId: string): Promise<EmbeddedVideo[]> {
  const rows = getDb()
    .prepare("SELECT video_id, title, thumbnail, chunk_count, embedded_at FROM videos WHERE channel_id = ? ORDER BY embedded_at DESC")
    .all(channelId) as any[];
  return rows.map((r) => ({
    videoId: r.video_id,
    title: r.title,
    thumbnail: r.thumbnail || undefined,
    chunkCount: r.chunk_count,
    embeddedAt: r.embedded_at,
  }));
}

export async function getEmbeddedVideoIds(channelId: string): Promise<Set<string>> {
  // Only videos that actually produced chunks count as embedded. Videos skipped
  // (no transcript / transient fetch failure) have chunk_count 0 and stay
  // eligible for retry on the next build instead of being poisoned forever.
  const rows = getDb().prepare("SELECT video_id FROM videos WHERE channel_id = ? AND chunk_count > 0").all(channelId) as { video_id: string }[];
  return new Set(rows.map((r) => r.video_id));
}

export async function saveChatTurn(channelId: string, turn: ChatTurn): Promise<void> {
  getDb()
    .prepare("INSERT INTO chats (channel_id, role, content, sources) VALUES (?, ?, ?, ?)")
    .run(channelId, turn.role, turn.content, turn.sources ? JSON.stringify(turn.sources) : null);
}

export async function getChatHistory(channelId: string): Promise<ChatTurn[]> {
  const rows = getDb()
    .prepare("SELECT role, content, sources FROM chats WHERE channel_id = ? ORDER BY id ASC")
    .all(channelId) as { role: string; content: string; sources: string | null }[];
  return rows.map((r) => ({
    role: r.role as ChatTurn["role"],
    content: r.content,
    sources: r.sources ? JSON.parse(r.sources) : undefined,
  }));
}

export async function getMetaVideoIds(channelId: string): Promise<Set<string>> {
  const rows = getDb().prepare("SELECT video_id FROM video_meta WHERE channel_id = ?").all(channelId) as { video_id: string }[];
  return new Set(rows.map((r) => r.video_id));
}

export async function isChannelMetaIndexed(channelId: string): Promise<boolean> {
  const row = getDb().prepare("SELECT 1 FROM video_meta WHERE channel_id = ? LIMIT 1").get(channelId);
  return !!row;
}

export async function saveVideoMeta(
  channelId: string,
  meta: { channelTitle: string; channelThumbnail?: string },
  rows: VideoMetaInput[]
): Promise<void> {
  const d = getDb();
  const tx = d.transaction(() => {
    d.prepare(
      `INSERT INTO channels (channel_id, title, thumbnail, last_embedded_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         title = excluded.title,
         thumbnail = COALESCE(excluded.thumbnail, channels.thumbnail)`
    ).run(channelId, meta.channelTitle, meta.channelThumbnail || null, now());
    const ins = d.prepare(
      `INSERT INTO video_meta
        (channel_id, video_id, source, title, description, thumbnail, duration, published_at, view_count, is_short, embedding)
       VALUES (?, ?, 'youtube', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_id, video_id) DO UPDATE SET
         title = excluded.title, description = excluded.description,
         thumbnail = excluded.thumbnail, duration = excluded.duration,
         published_at = excluded.published_at, view_count = excluded.view_count,
         is_short = excluded.is_short, embedding = excluded.embedding`
    );
    for (const v of rows) {
      ins.run(
        channelId, v.id, v.title, v.description || "", v.thumbnail || null,
        v.duration || null, v.publishedAt || null,
        v.viewCount ? parseInt(v.viewCount, 10) : null, v.isShort ? 1 : 0,
        JSON.stringify(v.embedding)
      );
    }
    const c = d.prepare("SELECT COUNT(*) AS n FROM video_meta WHERE channel_id = ?").get(channelId) as { n: number };
    d.prepare("UPDATE channels SET meta_indexed_at = ?, meta_video_count = ? WHERE channel_id = ?").run(now(), c.n, channelId);
  });
  tx();
}

export async function scoreVideos(channelId: string, queryEmbedding: number[], limit = 200): Promise<ScoredVideo[]> {
  const rows = getDb()
    .prepare(
      `SELECT video_id, source, title, description, thumbnail, duration,
              published_at, view_count, is_short, embedding
       FROM video_meta WHERE channel_id = ?`
    )
    .all(channelId) as any[];
  return rows
    .map((r) => ({
      videoId: r.video_id,
      source: (r.source === "spotify" ? "spotify" : "youtube") as "youtube" | "spotify",
      title: r.title,
      description: r.description || undefined,
      thumbnail: r.thumbnail || undefined,
      duration: r.duration || undefined,
      publishedAt: r.published_at || undefined,
      viewCount: r.view_count != null ? String(r.view_count) : undefined,
      isShort: !!r.is_short,
      _raw: cosine(queryEmbedding, JSON.parse(r.embedding)),
    }))
    .sort((a, b) => b._raw - a._raw)
    .slice(0, limit)
    .map(({ _raw, ...v }) => ({ ...v, score: Math.max(0, Math.min(100, Math.round(_raw * 100))) }));
}

export async function getVideoMetaForIds(
  channelId: string,
  ids: string[]
): Promise<{ videoId: string; title: string; thumbnail?: string }[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT video_id, title, thumbnail FROM video_meta WHERE channel_id = ? AND video_id IN (${placeholders})`)
    .all(channelId, ...ids) as any[];
  return rows.map((r) => ({ videoId: r.video_id, title: r.title, thumbnail: r.thumbnail || undefined }));
}

// ── embed progress ──
export async function setEmbedStatus(channelId: string, processed: number, total: number, done: boolean): Promise<void> {
  getDb()
    .prepare(
      `INSERT INTO embed_progress (channel_id, processed, total, done, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         processed = excluded.processed, total = excluded.total,
         done = excluded.done, updated_at = excluded.updated_at`
    )
    .run(channelId, processed, total, done ? 1 : 0, now());
}

export async function getEmbedStatus(channelId: string): Promise<{ processed: number; total: number; done: boolean }> {
  const row = getDb()
    .prepare("SELECT processed, total, done FROM embed_progress WHERE channel_id = ?")
    .get(channelId) as { processed: number; total: number; done: number } | undefined;
  if (!row) return { processed: 0, total: 0, done: false };
  return { processed: row.processed, total: row.total, done: !!row.done };
}

// ── raw transcript reconstruction (concatenate chunks) ──
export async function loadChannelTranscript(channelId: string): Promise<JoinedTranscript> {
  const rows = getDb()
    .prepare("SELECT video_id, video_title, chunk_text FROM embeddings WHERE channel_id = ? ORDER BY video_id, chunk_start")
    .all(channelId) as { video_id: string; video_title: string; chunk_text: string }[];
  return joinTranscript(rows);
}

// ── usage tracking ──
export async function recordUsage(kind: string, model: string, promptTokens: number, completionTokens: number): Promise<void> {
  getDb()
    .prepare("INSERT INTO usage (kind, model, prompt_tokens, completion_tokens) VALUES (?, ?, ?, ?)")
    .run(kind, model, promptTokens | 0, completionTokens | 0);
}

export async function getUsage(): Promise<UsageAgg> {
  const rows = getDb()
    .prepare(
      `SELECT kind, model, SUM(prompt_tokens) AS pt, SUM(completion_tokens) AS ct, COUNT(*) AS n
       FROM usage GROUP BY kind, model`
    )
    .all() as { kind: string; model: string; pt: number; ct: number; n: number }[];
  return { rows: rows.map((r) => ({ kind: r.kind, model: r.model, promptTokens: r.pt, completionTokens: r.ct, requests: r.n })) };
}
