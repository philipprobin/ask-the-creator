import type {
  Chunk,
  RetrievedSource,
  EmbeddedChannel,
  EmbeddedVideo,
  ChatTurn,
  ScoredVideo,
} from "../types";
import type { SaveMeta, VideoMetaInput } from "../db";
import type { JoinedTranscript } from "./join";

export interface EmbedStatus {
  processed: number;
  total: number;
  done: boolean;
}

/** Per (kind, model) token totals — cost is computed from these at read time. */
export interface UsageAggRow {
  kind: string; // "chat" | "embed"
  model: string;
  promptTokens: number;
  completionTokens: number;
  requests: number;
}
export interface UsageAgg {
  rows: UsageAggRow[];
}

/** Common surface every storage backend (pgvector / sqlite / memory) implements. */
export interface StoreBackend {
  saveChunks(channelId: string, chunks: Chunk[], meta: SaveMeta): Promise<void>;
  hasChannel(channelId: string): Promise<boolean>;
  channelChunkCount(channelId: string): Promise<number>;
  search(channelId: string, queryEmbedding: number[], topK?: number): Promise<RetrievedSource[]>;
  listChannels(): Promise<EmbeddedChannel[]>;
  listVideosForChannel(channelId: string): Promise<EmbeddedVideo[]>;
  getEmbeddedVideoIds(channelId: string): Promise<Set<string>>;
  saveChatTurn(channelId: string, turn: ChatTurn): Promise<void>;
  getChatHistory(channelId: string): Promise<ChatTurn[]>;
  getMetaVideoIds(channelId: string): Promise<Set<string>>;
  isChannelMetaIndexed(channelId: string): Promise<boolean>;
  saveVideoMeta(
    channelId: string,
    meta: { channelTitle: string; channelThumbnail?: string },
    rows: VideoMetaInput[]
  ): Promise<void>;
  scoreVideos(channelId: string, queryEmbedding: number[], limit?: number): Promise<ScoredVideo[]>;
  getVideoMetaForIds(
    channelId: string,
    ids: string[]
  ): Promise<{ videoId: string; title: string; thumbnail?: string }[]>;
  setEmbedStatus(channelId: string, processed: number, total: number, done: boolean): Promise<void>;
  getEmbedStatus(channelId: string): Promise<EmbedStatus>;
  loadChannelTranscript(channelId: string): Promise<JoinedTranscript>;
  recordUsage(kind: string, model: string, promptTokens: number, completionTokens: number): Promise<void>;
  getUsage(): Promise<UsageAgg>;
}
