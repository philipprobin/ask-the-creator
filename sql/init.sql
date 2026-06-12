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

-- Index for fast channel lookup
CREATE INDEX IF NOT EXISTS idx_embeddings_channel ON embeddings(channel_id);

-- Index for cosine similarity search (HNSW for speed, or IVFFlat for smaller datasets)
-- Using cosine distance (1 - cosine_similarity)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings 
  USING hnsw (embedding vector_cosine_ops);

-- Optional: composite index for channel + vector search
CREATE INDEX IF NOT EXISTS idx_embeddings_channel_vector ON embeddings(channel_id) 
  INCLUDE (embedding);
