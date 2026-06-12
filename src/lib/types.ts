export interface Channel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount?: string;
  videoCount?: string;
}

export interface VideoMeta {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  duration?: string;
  isShort: boolean;
}

export interface TranscriptSegment {
  text: string;
  start: number; // seconds
  duration: number;
}

export interface Chunk {
  videoId: string;
  videoTitle: string;
  text: string;
  start: number; // seconds, for deep-link timestamp
  embedding?: number[];
}

export interface EmbedFilters {
  shortsOnly: boolean;
  includeVideos: boolean;
  maxVideos: number;
  order?: "date" | "viewCount";
}

export interface RetrievedSource {
  videoId: string;
  videoTitle: string;
  start: number;
  text: string;
  score: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedSource[];
}

export interface EmbeddedChannel {
  channelId: string;
  title: string;
  thumbnail?: string;
  videoCount: number;
  chunkCount: number;
  lastEmbeddedAt: string;
}

export interface EmbeddedVideo {
  videoId: string;
  title: string;
  thumbnail?: string;
  chunkCount: number;
  embeddedAt: string;
}
