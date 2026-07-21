import { Pool } from "pg";
import type {
  Chunk,
  RetrievedSource,
  EmbeddedChannel,
  EmbeddedVideo,
  ChatTurn,
  VideoMeta,
  ScoredVideo,
} from "./types";
import { joinTranscript } from "./store/join";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");
    // Strip sslmode/supa params to avoid conflict with explicit ssl option.
    const cleanUrl = dbUrl
      .replace(/[?&]sslmode=[^&]*/g, "")
      .replace(/[?&]supa=[^&]*/g, "");
    pool = new Pool({
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export interface SaveMeta {
  channelTitle: string;
  channelThumbnail?: string;
  // per-video metadata for the videos table
  videos: { videoId: string; title: string; thumbnail?: string }[];
}

/**
 * Incrementally save chunks + channel/video metadata.
 * Does NOT delete existing chunks — only appends new videos.
 * Caller is responsible for filtering out already-embedded videos.
 */
export async function saveChunks(
  channelId: string,
  chunks: Chunk[],
  meta: SaveMeta
): Promise<void> {
  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Upsert channel
    await client.query(
      `INSERT INTO channels (channel_id, title, thumbnail, last_embedded_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (channel_id) DO UPDATE
         SET title = EXCLUDED.title,
             thumbnail = COALESCE(EXCLUDED.thumbnail, channels.thumbnail),
             last_embedded_at = NOW()`,
      [channelId, meta.channelTitle, meta.channelThumbnail || null]
    );

    // Insert chunks
    for (const chunk of chunks) {
      if (!chunk.embedding) continue;
      await client.query(
        `INSERT INTO embeddings
         (channel_id, video_id, video_title, chunk_text, chunk_start, embedding)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          channelId,
          chunk.videoId,
          chunk.videoTitle,
          chunk.text,
          chunk.start,
          JSON.stringify(chunk.embedding),
        ]
      );
    }

    // Upsert per-video rows with chunk counts
    const counts = new Map<string, number>();
    for (const c of chunks) {
      counts.set(c.videoId, (counts.get(c.videoId) || 0) + 1);
    }
    for (const v of meta.videos) {
      const cc = counts.get(v.videoId) || 0;
      await client.query(
        `INSERT INTO videos (channel_id, video_id, title, thumbnail, chunk_count, has_transcript, embedded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (channel_id, video_id) DO UPDATE
           SET title = EXCLUDED.title,
               thumbnail = COALESCE(EXCLUDED.thumbnail, videos.thumbnail),
               chunk_count = EXCLUDED.chunk_count,
               has_transcript = EXCLUDED.has_transcript,
               embedded_at = NOW()`,
        [channelId, v.videoId, v.title, v.thumbnail || null, cc, cc > 0]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function hasChannel(channelId: string): Promise<boolean> {
  const db = getPool();
  const result = await db.query(
    "SELECT 1 FROM embeddings WHERE channel_id = $1 LIMIT 1",
    [channelId]
  );
  return result.rowCount! > 0;
}

export async function channelChunkCount(channelId: string): Promise<number> {
  const db = getPool();
  const result = await db.query(
    "SELECT COUNT(*) as count FROM embeddings WHERE channel_id = $1",
    [channelId]
  );
  return parseInt(result.rows[0]?.count || "0");
}

export async function search(
  channelId: string,
  queryEmbedding: number[],
  topK = 6
): Promise<RetrievedSource[]> {
  const db = getPool();
  const result = await db.query(
    `SELECT video_id, video_title, chunk_start as start, chunk_text as text,
            1 - (embedding <=> $2::vector) as score
     FROM embeddings
     WHERE channel_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [channelId, JSON.stringify(queryEmbedding), topK]
  );
  return result.rows.map((row) => ({
    videoId: row.video_id,
    videoTitle: row.video_title,
    start: parseFloat(row.start),
    text: row.text,
    score: parseFloat(row.score),
  }));
}

/** List all embedded creators with counts. */
export async function listChannels(): Promise<EmbeddedChannel[]> {
  const db = getPool();
  const result = await db.query(
    `SELECT c.channel_id, c.title, c.thumbnail, c.last_embedded_at,
            COUNT(DISTINCT v.video_id) AS video_count,
            COALESCE(SUM(v.chunk_count), 0) AS chunk_count
     FROM channels c
     LEFT JOIN videos v ON v.channel_id = c.channel_id
     GROUP BY c.channel_id, c.title, c.thumbnail, c.last_embedded_at
     ORDER BY c.last_embedded_at DESC`
  );
  return result.rows.map((r) => ({
    channelId: r.channel_id,
    title: r.title,
    thumbnail: r.thumbnail || undefined,
    videoCount: parseInt(r.video_count),
    chunkCount: parseInt(r.chunk_count),
    lastEmbeddedAt: r.last_embedded_at,
  }));
}

/** List embedded videos for a channel. */
export async function listVideosForChannel(
  channelId: string
): Promise<EmbeddedVideo[]> {
  const db = getPool();
  const result = await db.query(
    `SELECT video_id, title, thumbnail, chunk_count, embedded_at
     FROM videos WHERE channel_id = $1
     ORDER BY embedded_at DESC`,
    [channelId]
  );
  return result.rows.map((r) => ({
    videoId: r.video_id,
    title: r.title,
    thumbnail: r.thumbnail || undefined,
    chunkCount: parseInt(r.chunk_count),
    embeddedAt: r.embedded_at,
  }));
}

/** Get set of already-embedded video IDs (for incremental dedup). */
export async function getEmbeddedVideoIds(
  channelId: string
): Promise<Set<string>> {
  const db = getPool();
  const result = await db.query(
    "SELECT video_id FROM videos WHERE channel_id = $1",
    [channelId]
  );
  return new Set(result.rows.map((r) => r.video_id));
}

/** Save one chat turn. */
export async function saveChatTurn(
  channelId: string,
  turn: ChatTurn
): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO chats (channel_id, role, content, sources)
     VALUES ($1, $2, $3, $4)`,
    [channelId, turn.role, turn.content, turn.sources ? JSON.stringify(turn.sources) : null]
  );
}

/** Load chat history for a channel. */
export async function getChatHistory(channelId: string): Promise<ChatTurn[]> {
  const db = getPool();
  const result = await db.query(
    `SELECT role, content, sources FROM chats
     WHERE channel_id = $1 ORDER BY created_at ASC, id ASC`,
    [channelId]
  );
  return result.rows.map((r) => ({
    role: r.role,
    content: r.content,
    sources: r.sources || undefined,
  }));
}

// ─────────────────────────────────────────────────────────────
// video_meta — question→video relevance index (title + description)
// ─────────────────────────────────────────────────────────────

export type VideoMetaInput = VideoMeta & { embedding: number[] };

/** Video IDs already present in the meta index (incremental dedup). */
export async function getMetaVideoIds(channelId: string): Promise<Set<string>> {
  const db = getPool();
  const result = await db.query(
    "SELECT video_id FROM video_meta WHERE channel_id = $1",
    [channelId]
  );
  return new Set(result.rows.map((r) => r.video_id));
}

export async function isChannelMetaIndexed(channelId: string): Promise<boolean> {
  const db = getPool();
  const result = await db.query(
    "SELECT 1 FROM video_meta WHERE channel_id = $1 LIMIT 1",
    [channelId]
  );
  return result.rowCount! > 0;
}

/** Upsert channel + a batch of scored-video metadata rows (with embeddings). */
export async function saveVideoMeta(
  channelId: string,
  meta: { channelTitle: string; channelThumbnail?: string },
  rows: VideoMetaInput[]
): Promise<void> {
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO channels (channel_id, title, thumbnail, last_embedded_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (channel_id) DO UPDATE
         SET title = EXCLUDED.title,
             thumbnail = COALESCE(EXCLUDED.thumbnail, channels.thumbnail)`,
      [channelId, meta.channelTitle, meta.channelThumbnail || null]
    );
    for (const v of rows) {
      await client.query(
        `INSERT INTO video_meta
         (channel_id, video_id, source, title, description, thumbnail, duration, published_at, view_count, is_short, embedding)
         VALUES ($1,$2,'youtube',$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (channel_id, video_id) DO UPDATE
           SET title = EXCLUDED.title,
               description = EXCLUDED.description,
               thumbnail = EXCLUDED.thumbnail,
               duration = EXCLUDED.duration,
               published_at = EXCLUDED.published_at,
               view_count = EXCLUDED.view_count,
               is_short = EXCLUDED.is_short,
               embedding = EXCLUDED.embedding`,
        [
          channelId,
          v.id,
          v.title,
          v.description || "",
          v.thumbnail || null,
          v.duration || null,
          v.publishedAt || null,
          v.viewCount ? parseInt(v.viewCount, 10) : null,
          v.isShort,
          JSON.stringify(v.embedding),
        ]
      );
    }
    const count = await client.query(
      "SELECT COUNT(*)::int AS n FROM video_meta WHERE channel_id = $1",
      [channelId]
    );
    await client.query(
      "UPDATE channels SET meta_indexed_at = NOW(), meta_video_count = $2 WHERE channel_id = $1",
      [channelId, count.rows[0].n]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Rank a channel's videos by cosine similarity to the question embedding. */
export async function scoreVideos(
  channelId: string,
  queryEmbedding: number[],
  limit = 200
): Promise<ScoredVideo[]> {
  const db = getPool();
  const result = await db.query(
    `SELECT video_id, source, title, description, thumbnail, duration,
            published_at, view_count, is_short,
            1 - (embedding <=> $2::vector) AS score
     FROM video_meta
     WHERE channel_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [channelId, JSON.stringify(queryEmbedding), limit]
  );
  return result.rows.map((r) => ({
    videoId: r.video_id,
    source: r.source === "spotify" ? "spotify" : "youtube",
    title: r.title,
    description: r.description || undefined,
    thumbnail: r.thumbnail || undefined,
    duration: r.duration || undefined,
    publishedAt: r.published_at || undefined,
    viewCount: r.view_count != null ? String(r.view_count) : undefined,
    isShort: !!r.is_short,
    score: Math.max(0, Math.min(100, Math.round(parseFloat(r.score) * 100))),
  }));
}

/** Minimal title/thumbnail lookup for a set of selected video IDs (used by embed). */
export async function getVideoMetaForIds(
  channelId: string,
  ids: string[]
): Promise<{ videoId: string; title: string; thumbnail?: string }[]> {
  if (ids.length === 0) return [];
  const db = getPool();
  const result = await db.query(
    `SELECT video_id, title, thumbnail FROM video_meta
     WHERE channel_id = $1 AND video_id = ANY($2)`,
    [channelId, ids]
  );
  return result.rows.map((r) => ({
    videoId: r.video_id,
    title: r.title,
    thumbnail: r.thumbnail || undefined,
  }));
}

// ─────────────────────────────────────────────────────────────
// embed progress (temp table, mirrors the sqlite backend)
// ─────────────────────────────────────────────────────────────

export async function setEmbedStatus(
  channelId: string,
  processed: number,
  total: number,
  done: boolean
): Promise<void> {
  const db = getPool();
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS embed_progress (
        channel_id TEXT PRIMARY KEY, processed INT, total INT,
        done BOOLEAN, updated_at TIMESTAMPTZ DEFAULT NOW()
      )`);
    await db.query(
      `INSERT INTO embed_progress (channel_id, processed, total, done)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (channel_id) DO UPDATE
         SET processed = $2, total = $3, done = $4, updated_at = NOW()`,
      [channelId, processed, total, done]
    );
  } catch (e) {
    console.error("Failed to set embed status:", e);
  }
}

export async function getEmbedStatus(
  channelId: string
): Promise<{ processed: number; total: number; done: boolean }> {
  const db = getPool();
  try {
    const r = await db.query(
      "SELECT processed, total, done FROM embed_progress WHERE channel_id = $1",
      [channelId]
    );
    if (r.rows.length === 0) return { processed: 0, total: 0, done: false };
    return { processed: r.rows[0].processed, total: r.rows[0].total, done: r.rows[0].done };
  } catch (e) {
    console.error("Failed to get embed status:", e);
    return { processed: 0, total: 0, done: false };
  }
}

/** Reconstruct a channel's transcript by concatenating stored chunks in order. */
export async function loadChannelTranscript(
  channelId: string
): Promise<{ text: string; videoCount: number }> {
  const db = getPool();
  const result = await db.query(
    `SELECT video_id, video_title, chunk_text FROM embeddings
     WHERE channel_id = $1 ORDER BY video_id, chunk_start`,
    [channelId]
  );
  return joinTranscript(
    result.rows.map((r) => ({
      video_id: r.video_id,
      video_title: r.video_title,
      chunk_text: r.chunk_text,
    }))
  );
}
