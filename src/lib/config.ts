export type StorageBackend = "pgvector" | "sqlite" | "memory";

function resolveBackend(): StorageBackend {
  const explicit = process.env.STORAGE_BACKEND as StorageBackend | undefined;
  if (explicit === "pgvector" || explicit === "sqlite" || explicit === "memory") {
    return explicit;
  }
  // Default: pgvector when a Postgres URL is configured (hosted/cloud),
  // otherwise a local SQLite file (zero-setup self-host default).
  return process.env.DATABASE_URL ? "pgvector" : "sqlite";
}

export const config = {
  openaiKey: process.env.OPENAI_API_KEY || "",
  youtubeKey: process.env.YOUTUBE_API_KEY || "",
  databaseUrl: process.env.DATABASE_URL || "",
  chatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  embedModel: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
  storageBackend: resolveBackend(),
  sqlitePath: process.env.SQLITE_PATH || "data/ask-the-creator.db",
  // Answer routing: below this estimated transcript-token size we stuff the full
  // transcript into the chat context (LLM-only, no vector search / no embeddings).
  // Above it we fall back to RAG. Keep well under the chat model's context window.
  llmOnlyMaxTokens: parseInt(process.env.LLM_ONLY_MAX_TOKENS || "", 10) || 100_000,
};

/** USD per 1M tokens, per model. Used to turn stored token counts into a cost estimate. */
export const MODEL_PRICES: Record<string, { inPerM: number; outPerM: number }> = {
  "gpt-4o-mini": { inPerM: 0.15, outPerM: 0.6 },
  "gpt-4o": { inPerM: 2.5, outPerM: 10 },
  "text-embedding-3-small": { inPerM: 0.02, outPerM: 0 },
  "text-embedding-3-large": { inPerM: 0.13, outPerM: 0 },
};
/** Fallback price for unknown models so the estimate is never wildly off. */
export const DEFAULT_PRICE = { inPerM: 0.5, outPerM: 1.5 };

export function costUsd(model: string, promptTokens: number, completionTokens: number): number {
  const p = MODEL_PRICES[model] || DEFAULT_PRICE;
  return (promptTokens / 1e6) * p.inPerM + (completionTokens / 1e6) * p.outPerM;
}

export const hasOpenAI = () => config.openaiKey.length > 0;
export const hasYouTube = () => config.youtubeKey.length > 0;
export const hasDatabase = () => config.databaseUrl.length > 0;

/** True when any core integration is missing -> features fall back to mock data. */
export const isMock = () => !hasOpenAI() || !hasYouTube();
