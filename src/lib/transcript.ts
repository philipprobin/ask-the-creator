import { hasOpenAI, config } from "./config";
import type { TranscriptSegment } from "./types";

/**
 * Fetch a transcript for a video.
 *
 * Transcripts come from the Supadata API (SUPADATA_API_KEY). Keyless YouTube
 * extraction (InnerTube / timedtext scraping) was dropped: YouTube's anti-bot
 * measures (nsig / PO tokens) make it unreliable and a constant maintenance
 * treadmill. Supadata abstracts that away and works from any IP.
 *
 * Behavior:
 *  - No YouTube key at all -> offline/demo mode: channels & IDs are mocked, so
 *    return a mock transcript (never hits the network).
 *  - Real mode, no SUPADATA_API_KEY -> can't fetch -> [] (caller skips the video).
 *  - Real mode with key -> Supadata; on failure/empty -> [] (skip cleanly, never
 *    substitute mock content in production).
 */
export async function fetchTranscript(
  videoId: string,
  videoTitle: string
): Promise<TranscriptSegment[]> {
  if (!hasOpenAI()) {
    // Pure demo mode (no OpenAI key) — channels/videos are mocked too.
    console.log(`⚠ Using mock transcript for ${videoId} (${videoTitle})`);
    return mockTranscript(videoTitle);
  }

  const supadataKey = config.supadataKey;
  if (!supadataKey) {
    console.warn(`✗ SUPADATA_API_KEY not set — cannot fetch transcript for ${videoId}; skipping`);
    return [];
  }

  try {
    const segments = await fetchSupadataTranscript(videoId, supadataKey);
    if (segments.length > 0) {
      console.log(`✓ Supadata transcript for ${videoId}: ${segments.length} segments`);
      return segments;
    }
  } catch (err) {
    console.warn(`Supadata failed for ${videoId}:`, err);
  }

  console.warn(`✗ No transcript available for ${videoId} (${videoTitle}) — skipping`);
  return [];
}

/**
 * Fetch transcript via Supadata API.
 * Docs: https://docs.supadata.ai/api-reference/endpoint/transcript/transcript
 */
async function fetchSupadataTranscript(
  videoId: string,
  apiKey: string
): Promise<TranscriptSegment[]> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const url = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}&mode=auto&lang=en`;

  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Supadata ${res.status}: ${error.message || "Unknown error"}`);
  }
  const data = await res.json();

  // Async job response = video too large for sync transcription.
  if (data.jobId) {
    throw new Error(`Video too large, got jobId ${data.jobId} - async processing not yet implemented`);
  }
  const content = data.content;
  if (!content) throw new Error("No content in Supadata response");

  if (typeof content === "string") {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    return sentences.map((text, i) => ({ text: text.trim(), start: i * 30, duration: 30 }));
  }
  // Array of chunks with offset/duration in ms.
  return content.map((chunk: any) => ({
    text: chunk.text || "",
    start: (chunk.offset || 0) / 1000,
    duration: (chunk.duration || 0) / 1000,
  }));
}

function mockTranscript(videoTitle: string): TranscriptSegment[] {
  const lines = [
    `Hey everyone, welcome back. Today on "${videoTitle}" we're diving deep.`,
    "The most important thing I've learned is to stay consistent and ship often.",
    "A lot of people ask me how I stay motivated — honestly it's about systems, not willpower.",
    "If you take one thing from this video, focus on the fundamentals first.",
    "Thanks for watching, smash that like button and I'll see you in the next one.",
  ];
  return lines.map((text, i) => ({ text, start: i * 30, duration: 30 }));
}

/** Split segments into ~chunkChars windows, keeping the start time of the first segment. */
export function chunkSegments(
  segments: TranscriptSegment[],
  chunkChars = 900
): { text: string; start: number }[] {
  const chunks: { text: string; start: number }[] = [];
  let buf = "";
  let start = segments[0]?.start ?? 0;
  for (const seg of segments) {
    if (buf.length === 0) start = seg.start;
    buf += (buf ? " " : "") + seg.text;
    if (buf.length >= chunkChars) {
      chunks.push({ text: buf, start });
      buf = "";
    }
  }
  if (buf.trim()) chunks.push({ text: buf, start });
  return chunks;
}
