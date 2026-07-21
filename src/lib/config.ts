import fs from "fs";
import path from "path";

export type StorageBackend = "pgvector" | "sqlite" | "memory";
export type KeyName = "OPENAI_API_KEY" | "YOUTUBE_API_KEY" | "SUPADATA_API_KEY";

function resolveBackend(): StorageBackend {
  const explicit = process.env.STORAGE_BACKEND as StorageBackend | undefined;
  if (explicit === "pgvector" || explicit === "sqlite" || explicit === "memory") {
    return explicit;
  }
  // Default: pgvector when a Postgres URL is configured (hosted/cloud),
  // otherwise a local SQLite file (zero-setup self-host default).
  return process.env.DATABASE_URL ? "pgvector" : "sqlite";
}

// ── Locally-saved keys (from the in-app setup wizard) ──
// Env vars always win, so on Vercel/hosted the keys come from the environment
// (read-only) and this file is irrelevant. Locally the wizard writes them here.
const LOCAL_CONFIG_PATH = process.env.LOCAL_CONFIG_PATH || "data/config.json";
let fileKeys: Partial<Record<KeyName, string>> = {};
let fileKeysMtime = -1;

/**
 * Return the wizard-saved keys, re-reading the file when it changes on disk.
 * The mtime check makes a key saved at runtime (settings panel) take effect
 * immediately — without it, a long-running server keeps a stale cache from
 * import time and never sees the newly-added key.
 */
function currentFileKeys(): Partial<Record<KeyName, string>> {
  try {
    const p = path.resolve(LOCAL_CONFIG_PATH);
    const m = fs.statSync(p).mtimeMs;
    if (m !== fileKeysMtime) {
      fileKeys = JSON.parse(fs.readFileSync(p, "utf8"));
      fileKeysMtime = m;
    }
  } catch {
    // File missing/unreadable → keep whatever we last had (possibly {}).
  }
  return fileKeys;
}

function resolveKey(name: KeyName): string {
  return process.env[name] || currentFileKeys()[name] || "";
}

/** True when the key is supplied by the environment (i.e. not editable in-app). */
export function isEnvKey(name: KeyName): boolean {
  return !!process.env[name];
}

/** Persist keys to the local config file (self-host). No-op values are ignored. */
export function setLocalKeys(partial: Partial<Record<KeyName, string>>): void {
  const clean: Partial<Record<KeyName, string>> = {};
  for (const [k, v] of Object.entries(partial)) {
    if (typeof v === "string" && v.trim()) clean[k as KeyName] = v.trim();
  }
  fileKeys = { ...currentFileKeys(), ...clean };
  const p = path.resolve(LOCAL_CONFIG_PATH);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(fileKeys, null, 2), { mode: 0o600 });
  try { fileKeysMtime = fs.statSync(p).mtimeMs; } catch { /* re-read next access */ }
}

export const config = {
  get openaiKey() { return resolveKey("OPENAI_API_KEY"); },
  get youtubeKey() { return resolveKey("YOUTUBE_API_KEY"); },
  get supadataKey() { return resolveKey("SUPADATA_API_KEY"); },
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
export const hasSupadata = () => config.supadataKey.length > 0;
export const hasDatabase = () => config.databaseUrl.length > 0;

/** True when any core integration is missing -> features fall back to mock data. */
export const isMock = () => !hasOpenAI() || !hasYouTube();
