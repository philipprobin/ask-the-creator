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
