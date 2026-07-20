export interface BuildResult {
  channelId: string;
  channelTitle: string;
  videosProcessed: number;
  videosWithTranscript: number;
  chunks: number;
  skipped?: { videoId: string; reason: string }[];
}
