export interface JoinedTranscript {
  /** Full stuffable text, grouped per video with a `## title` header. */
  text: string;
  /** The videos included, in order — used to render source chips in LLM-only mode. */
  videos: { videoId: string; videoTitle: string }[];
}

/**
 * Reconstruct a stuffable transcript from ordered chunk rows by grouping per
 * video. Pure (no deps) so both the sqlite and postgres backends share it.
 */
export function joinTranscript(
  rows: { video_id: string; video_title: string; chunk_text: string }[]
): JoinedTranscript {
  const byVideo = new Map<string, { title: string; parts: string[] }>();
  for (const r of rows) {
    if (!byVideo.has(r.video_id)) byVideo.set(r.video_id, { title: r.video_title, parts: [] });
    byVideo.get(r.video_id)!.parts.push(r.chunk_text);
  }
  const blocks: string[] = [];
  const videos: { videoId: string; videoTitle: string }[] = [];
  let i = 0;
  for (const [videoId, { title, parts }] of byVideo) {
    i++;
    // Number each video so the model can cite it as [i], matching the source chips.
    blocks.push(`[${i}] ${title}\n${parts.join(" ")}`);
    videos.push({ videoId, videoTitle: title });
  }
  return { text: blocks.join("\n\n"), videos };
}
