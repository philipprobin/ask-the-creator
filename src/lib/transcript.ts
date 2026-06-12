import { hasYouTube } from "./config";
import type { TranscriptSegment } from "./types";

/**
 * Fetch a transcript for a video.
 * Strategy:
 *  1. Try Supadata API (bypasses YouTube IP blocks)
 *  2. Fall back to scraping watch page + timedtext
 *  3. Fall back to mock (dev mode without keys)
 */
export async function fetchTranscript(
  videoId: string,
  videoTitle: string
): Promise<TranscriptSegment[]> {
  const supadataKey = process.env.SUPADATA_API_KEY;

  // Try Supadata first if key is available
  if (supadataKey) {
    try {
      const segments = await fetchSupadataTranscript(videoId, supadataKey);
      if (segments.length > 0) {
        console.log(`✓ Supadata transcript for ${videoId}: ${segments.length} segments`);
        return segments;
      }
    } catch (err) {
      console.warn(`Supadata failed for ${videoId}:`, err);
    }
  }

  // Fall back to scraping if we have YouTube API key
  if (hasYouTube()) {
    try {
      const segments = await fetchScrapedTranscript(videoId);
      if (segments.length > 0) {
        console.log(`✓ Scraped transcript for ${videoId}: ${segments.length} segments`);
        return segments;
      }
    } catch (err) {
      console.warn(`Scraping failed for ${videoId}:`, err);
    }
  }

  // Dev mode fallback
  console.log(`⚠ Using mock transcript for ${videoId} (${videoTitle})`);
  return mockTranscript(videoTitle);
}

/**
 * Fetch transcript via Supadata API
 * Docs: https://docs.supadata.ai/api-reference/endpoint/transcript/transcript
 */
async function fetchSupadataTranscript(
  videoId: string,
  apiKey: string
): Promise<TranscriptSegment[]> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const url = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(
    videoUrl
  )}&mode=auto&lang=en`;

  const res = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `Supadata ${res.status}: ${error.message || "Unknown error"}`
    );
  }

  const data = await res.json();

  // Handle async job response
  if (data.jobId) {
    throw new Error(
      `Video too large, got jobId ${data.jobId} - async processing not yet implemented`
    );
  }

  // Parse content (array of chunks or plain text)
  const content = data.content;
  if (!content) {
    throw new Error("No content in Supadata response");
  }

  // If plain text mode (text=true), split into segments
  if (typeof content === "string") {
    // Simple split by sentence
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    return sentences.map((text, i) => ({
      text: text.trim(),
      start: i * 30, // fake timestamps
      duration: 30,
    }));
  }

  // Array of chunks with offset/duration (in milliseconds)
  return content.map((chunk: any) => ({
    text: chunk.text || "",
    start: (chunk.offset || 0) / 1000, // ms → seconds
    duration: (chunk.duration || 0) / 1000,
  }));
}

/**
 * Original scraping method (brittle, blocked on many IPs)
 */
async function fetchScrapedTranscript(
  videoId: string
): Promise<TranscriptSegment[]> {
  const tracks = await getCaptionTracks(videoId);
  if (!tracks.length) return [];

  // Prefer English, non-ASR
  const sorted = [...tracks].sort((a, b) => {
    const aEn = a.languageCode?.startsWith("en") ? 0 : 1;
    const bEn = b.languageCode?.startsWith("en") ? 0 : 1;
    if (aEn !== bEn) return aEn - bEn;
    const aAsr = a.kind === "asr" ? 1 : 0;
    const bAsr = b.kind === "asr" ? 1 : 0;
    return aAsr - bAsr;
  });

  const track = sorted[0];
  return await fetchTrack(track.baseUrl);
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

async function getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(
    `https://www.youtube.com/watch?v=${videoId}&hl=en`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }
  );
  const html = await res.text();
  const m = html.match(
    /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s
  );
  if (!m) return [];

  let json: any;
  try {
    json = JSON.parse(m[1]);
  } catch {
    return [];
  }

  const tracks =
    json?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  return tracks.map((t: any) => ({
    baseUrl: t.baseUrl,
    languageCode: t.languageCode,
    kind: t.kind,
  }));
}

async function fetchTrack(baseUrl: string): Promise<TranscriptSegment[]> {
  const url = baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=json3`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const events = data.events || [];
  const segments: TranscriptSegment[] = [];

  for (const ev of events) {
    if (!ev.segs) continue;
    const text = ev.segs
      .map((s: any) => s.utf8)
      .join("")
      .replace(/\n/g, " ")
      .trim();
    if (!text) continue;
    segments.push({
      text,
      start: (ev.tStartMs || 0) / 1000,
      duration: (ev.dDurationMs || 0) / 1000,
    });
  }
  return segments;
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
