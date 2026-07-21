/**
 * Reconstruct a stuffable transcript string from ordered chunk rows by grouping
 * per video. Pure (no deps) so both the sqlite and postgres backends can share it.
 */
export function joinTranscript(
  rows: { video_id: string; video_title: string; chunk_text: string }[]
): { text: string; videoCount: number } {
  const byVideo = new Map<string, { title: string; parts: string[] }>();
  for (const r of rows) {
    if (!byVideo.has(r.video_id)) byVideo.set(r.video_id, { title: r.video_title, parts: [] });
    byVideo.get(r.video_id)!.parts.push(r.chunk_text);
  }
  const blocks: string[] = [];
  for (const { title, parts } of byVideo.values()) {
    blocks.push(`## ${title}\n${parts.join(" ")}`);
  }
  return { text: blocks.join("\n\n"), videoCount: byVideo.size };
}
