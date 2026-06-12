import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");
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

/**
 * Set embed progress in a temp table (auto-cleaned after 1 hour)
 */
export async function setEmbedStatus(
  channelId: string,
  processed: number,
  total: number,
  done: boolean
): Promise<void> {
  const db = getPool();
  try {
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS embed_progress (
        channel_id TEXT PRIMARY KEY,
        processed INT,
        total INT,
        done BOOLEAN,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Upsert status
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

/**
 * Get embed progress from DB
 */
export async function getEmbedStatus(channelId: string): Promise<{
  processed: number;
  total: number;
  done: boolean;
}> {
  const db = getPool();
  try {
    const result = await db.query(
      `SELECT processed, total, done FROM embed_progress
       WHERE channel_id = $1`,
      [channelId]
    );

    if (result.rows.length === 0) {
      return { processed: 0, total: 0, done: false };
    }

    return {
      processed: result.rows[0].processed,
      total: result.rows[0].total,
      done: result.rows[0].done,
    };
  } catch (e) {
    console.error("Failed to get embed status:", e);
    return { processed: 0, total: 0, done: false };
  }
}
