-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Embeddings table: stores chunked transcript embeddings
CREATE TABLE IF NOT EXISTS embeddings (
  id SERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_start REAL NOT NULL,
  embedding vector(1536) NOT NULL,  -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_channel ON embeddings(channel_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Embedded creators (library view)
CREATE TABLE IF NOT EXISTS channels (
  channel_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  thumbnail TEXT,
  last_embedded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-video embedding overview + incremental dedup
CREATE TABLE IF NOT EXISTS videos (
  channel_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  chunk_count INT DEFAULT 0,
  has_transcript BOOLEAN DEFAULT TRUE,
  embedded_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, video_id)
);

-- Question→video relevance index: one embedding per video of (title + description).
CREATE TABLE IF NOT EXISTS video_meta (
  channel_id   TEXT NOT NULL,
  video_id     TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'youtube',   -- 'youtube' | 'spotify' (spotify unwired)
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  thumbnail    TEXT,
  duration     TEXT,                               -- ISO 8601
  published_at TIMESTAMPTZ,
  view_count   BIGINT,
  is_short     BOOLEAN DEFAULT FALSE,
  embedding    vector(1536) NOT NULL,              -- embed(title + "\n" + description)
  indexed_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_video_meta_channel ON video_meta(channel_id);
CREATE INDEX IF NOT EXISTS idx_video_meta_vec ON video_meta
  USING hnsw (embedding vector_cosine_ops);

-- Channel-level marker so metadata isn't re-scanned/re-embedded per question.
ALTER TABLE channels ADD COLUMN IF NOT EXISTS meta_indexed_at  TIMESTAMPTZ;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS meta_video_count INT DEFAULT 0;

-- Chat history per channel
CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL,
  role TEXT NOT NULL,          -- 'user' | 'assistant'
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chats_channel ON chats(channel_id, created_at);
