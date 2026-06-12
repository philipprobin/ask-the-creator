import { Pool } from "pg";
import type { Chunk, RetrievedSource } from "./types";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL not set");
    }
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }, // Supabase/Neon require SSL
    });
  }
  return pool;
}

/**
 * Save chunks to Postgres with pgvector embeddings
 */
export async function saveChunks(channelId: string, chunks: Chunk[]): Promise<void> {
  const db = getPool();
  const client = await db.connect();
  
  try {
    await client.query("BEGIN");

    // Delete existing embeddings for this channel (re-embed scenario)
    await client.query("DELETE FROM embeddings WHERE channel_id = $1", [channelId]);

    // Insert new chunks
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
          JSON.stringify(chunk.embedding), // pgvector accepts array as JSON string
        ]
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

/**
 * Check if channel has embeddings
 */
export async function hasChannel(channelId: string): Promise<boolean> {
  const db = getPool();
  const result = await db.query(
    "SELECT COUNT(*) as count FROM embeddings WHERE channel_id = $1",
    [channelId]
  );
  return parseInt(result.rows[0]?.count || "0") > 0;
}

/**
 * Get chunk count for a channel
 */
export async function channelChunkCount(channelId: string): Promise<number> {
  const db = getPool();
  const result = await db.query(
    "SELECT COUNT(*) as count FROM embeddings WHERE channel_id = $1",
    [channelId]
  );
  return parseInt(result.rows[0]?.count || "0");
}

/**
 * Semantic search using pgvector cosine similarity
 */
export async function search(
  channelId: string,
  queryEmbedding: number[],
  topK = 6
): Promise<RetrievedSource[]> {
  const db = getPool();
  
  // pgvector cosine distance operator: <=>
  // Lower distance = more similar (we negate to get similarity score)
  const result = await db.query(
    `SELECT 
       video_id, 
       video_title, 
       chunk_start as start, 
       chunk_text as text,
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
