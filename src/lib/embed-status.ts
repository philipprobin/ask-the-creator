/**
 * Embed progress tracking. Delegated to the active storage backend
 * (sqlite/pgvector/memory) via the store facade, so it no longer hard-requires
 * DATABASE_URL — the no-DB local default works without crashing.
 */
export { setEmbedStatus, getEmbedStatus } from "./store";
