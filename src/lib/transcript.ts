import { hasYouTube } from "./config";
import type { TranscriptSegment } from "./types";

/**
 * Fetch a transcript for a video without extra deps.
 * Strategy:
 *  1. Load the watch page, extract caption track list from ytInitialPlayerResponse.
 *  2. Fetch the chosen track's timedtext JSON (fmt=json3).
 * Falls back to mock segments when no YOUTUBE_API_KEY (offline/dev mode).
 *
 * Note: this relies on YouTube's public timedtext; it can be brittle. For
 * production hardening, swap in a dedicated transcript provider.
 */
export async function fetchTranscript(videoId: string, videoTitle: string): Promise<TranscriptSegment[]> {
  if (!hasYouTube()) return mockTranscript(videoTitle);

  try {
    const tracks = await getCaptionTracks(videoId);
    if (!tracks.length) return [];
    // Prefer English, else first; prefer non-ASR if available.
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
  } catch {
    return [];
  }
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

async function getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
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
    const text = ev.segs.map((s: any) => s.utf8).join("").replace(/\n/g, " ").trim();
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
