import { Innertube } from "youtubei.js";
import { config, hasYouTube, hasOpenAI } from "./config";
import type { Channel, VideoMeta, EmbedFilters } from "./types";

const API = "https://www.googleapis.com/youtube/v3";

/**
 * Channel search + video metadata.
 * - With YOUTUBE_API_KEY: official YouTube Data API (robust, full descriptions).
 * - Without: keyless via youtubei.js (InnerTube) — no GCP needed, but less rich
 *   (short/no descriptions, approximate counts) and more fragile.
 * - Pure demo (no OpenAI key): mock data so the UI is clickable offline.
 */

// ---- Mock data ----
const MOCK_CHANNELS: Channel[] = [
  { id: "mock-mkbhd", title: "Marques Brownlee (mock)", description: "Quality tech videos. (mock)", thumbnail: "https://yt3.googleusercontent.com/ytc/default.jpg", subscriberCount: "19000000", videoCount: "1700" },
  { id: "mock-veritasium", title: "Veritasium (mock)", description: "Science videos. (mock)", thumbnail: "https://yt3.googleusercontent.com/ytc/default.jpg", subscriberCount: "15000000", videoCount: "400" },
];

function mockVideos(channelId: string, count: number, shortsOnly = false): VideoMeta[] {
  const n = Math.min(count, 12);
  return Array.from({ length: n }).map((_, i) => ({
    id: `${channelId}-vid-${i}`,
    title: `${shortsOnly ? "Short" : "Video"} #${i + 1} (mock)`,
    description: `Mock description #${i + 1}. Set keys for real data.`,
    publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
    thumbnail: "https://i.ytimg.com/vi/default.jpg",
    viewCount: `${(n - i) * 100000}`,
    isShort: shortsOnly,
  }));
}

// ── public dispatchers ──
export async function searchChannels(query: string): Promise<Channel[]> {
  if (hasYouTube()) return searchChannelsDataApi(query);
  try {
    const r = await searchChannelsInnertube(query);
    if (r.length) return r;
  } catch (e) {
    console.warn("Keyless channel search (youtubei.js) failed:", e);
  }
  return hasOpenAI() ? [] : MOCK_CHANNELS;
}

export async function listChannelVideoMeta(channelId: string, cap = 300): Promise<VideoMeta[]> {
  if (hasYouTube()) return listChannelVideoMetaDataApi(channelId, cap);
  try {
    const r = await listChannelVideoMetaInnertube(channelId, cap);
    if (r.length) return r;
  } catch (e) {
    console.warn("Keyless channel videos (youtubei.js) failed:", e);
  }
  return hasOpenAI() ? [] : mockVideos(channelId, cap);
}

// ── keyless (youtubei.js / InnerTube) ──
let innertube: Promise<Innertube> | null = null;
function getYT(): Promise<Innertube> {
  if (!innertube) innertube = Innertube.create({ retrieve_player: false });
  return innertube;
}

function pickThumb(thumbs: any): string {
  const u = Array.isArray(thumbs) && thumbs.length ? String(thumbs[thumbs.length - 1]?.url ?? "") : "";
  return u.startsWith("//") ? "https:" + u : u; // youtubei.js returns protocol-relative avatar URLs
}
/** "1:31:24" -> seconds. */
function hmsToSeconds(t?: string): number | undefined {
  if (!t || !/^\d+(:\d+)+$/.test(t)) return undefined;
  return t.split(":").reduce((acc, p) => acc * 60 + parseInt(p, 10), 0);
}
/** Parse "1.2M", "454", "1,234 subscribers" → integer string, or undefined. */
function parseCount(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return undefined;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || "").toLowerCase()] ?? 1;
  const n = Math.round(parseFloat(m[1]) * mult);
  return isFinite(n) ? String(n) : undefined;
}
function isoFromSeconds(sec?: number): string | undefined {
  if (!sec || sec <= 0) return undefined;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}`;
}

async function searchChannelsInnertube(query: string): Promise<Channel[]> {
  const yt = await getYT();
  const res: any = await yt.search(query, { type: "channel" });
  const out: Channel[] = [];
  for (const r of (res?.results ?? []) as any[]) {
    if (r?.type !== "Channel") continue;
    const id = r.id ?? r.author?.id;
    if (!id) continue;
    out.push({
      id,
      title: r.author?.name ?? r.title?.text ?? "",
      description: r.description_snippet?.text ?? "",
      thumbnail: pickThumb(r.author?.thumbnails),
      // youtubei.js mislabels these — video_count.text actually carries the subscriber string.
      subscriberCount: parseCount(r.video_count?.text),
      videoCount: undefined, // not reliably available keyless
    });
    if (out.length >= 8) break;
  }
  return out;
}

async function listChannelVideoMetaInnertube(channelId: string, cap: number): Promise<VideoMeta[]> {
  const yt = await getYT();
  const channel: any = await yt.getChannel(channelId);
  let feed: any = await channel.getVideos();
  const out: VideoMeta[] = [];
  let guard = 0;
  while (out.length < cap && guard++ < 60) {
    const items: any[] = feed?.videos ?? [];
    if (!items.length) break;
    for (const v of items) {
      // Current youtubei.js returns "LockupView" nodes for channel videos.
      const id = v?.content_id ?? v?.id ?? v?.video_id;
      if (!id) continue;
      const md = v?.metadata;
      const badges = (v?.content_image?.overlays ?? []).flatMap((o: any) => o?.badges ?? []);
      const durText = badges.map((b: any) => b?.text).find((t: any) => typeof t === "string" && /^\d+(:\d+)+$/.test(t));
      const durSec = hmsToSeconds(durText);
      const rows = md?.metadata?.metadata_rows ?? [];
      const viewsText = rows
        .flatMap((r: any) => r?.metadata_parts ?? [])
        .map((p: any) => p?.text?.text)
        .find((t: any) => typeof t === "string" && /view/i.test(t));
      out.push({
        id,
        title: md?.title?.text ?? v?.title?.text ?? "",
        description: "", // channel listings don't include descriptions (title-only scoring)
        publishedAt: "",
        thumbnail: pickThumb(v?.content_image?.image ?? v?.thumbnails),
        duration: isoFromSeconds(durSec),
        viewCount: parseCount(viewsText),
        isShort: typeof durSec === "number" && durSec > 0 && durSec <= 60,
      });
      if (out.length >= cap) break;
    }
    if (out.length >= cap) break;
    if (feed?.has_continuation) feed = await feed.getContinuation();
    else break;
  }
  return out;
}

// ── YouTube Data API ----
async function searchChannelsDataApi(query: string): Promise<Channel[]> {
  const url = `${API}/search?part=snippet&type=channel&maxResults=8&q=${encodeURIComponent(query)}&key=${config.youtubeKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = await res.json();
  const ids: string[] = (data.items || []).map((it: any) => it.id.channelId).filter(Boolean);
  if (ids.length === 0) return [];

  const statsUrl = `${API}/channels?part=snippet,statistics&id=${ids.join(",")}&key=${config.youtubeKey}`;
  const statsRes = await fetch(statsUrl);
  const statsData = await statsRes.json();
  return (statsData.items || []).map((c: any) => ({
    id: c.id,
    title: c.snippet.title,
    description: c.snippet.description,
    thumbnail: c.snippet.thumbnails?.medium?.url || c.snippet.thumbnails?.default?.url || "",
    subscriberCount: c.statistics?.subscriberCount,
    videoCount: c.statistics?.videoCount,
  }));
}

async function listChannelVideoMetaDataApi(channelId: string, cap: number): Promise<VideoMeta[]> {
  const chUrl = `${API}/channels?part=contentDetails&id=${channelId}&key=${config.youtubeKey}`;
  const chRes = await fetch(chUrl);
  const chData = await chRes.json();
  const uploads = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  const out: VideoMeta[] = [];
  let pageToken = "";
  while (out.length < cap) {
    const plUrl = `${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}${pageToken ? `&pageToken=${pageToken}` : ""}&key=${config.youtubeKey}`;
    const plRes = await fetch(plUrl);
    if (!plRes.ok) break;
    const plData = await plRes.json();
    const ids = (plData.items || []).map((it: any) => it.contentDetails.videoId).join(",");
    if (!ids) break;

    const vUrl = `${API}/videos?part=snippet,contentDetails,statistics&id=${ids}&key=${config.youtubeKey}`;
    const vRes = await fetch(vUrl);
    const vData = await vRes.json();
    for (const v of vData.items || []) {
      const seconds = parseISODuration(v.contentDetails?.duration || "");
      out.push({
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description || "",
        publishedAt: v.snippet.publishedAt,
        thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
        duration: v.contentDetails?.duration,
        viewCount: v.statistics?.viewCount,
        isShort: seconds > 0 && seconds <= 60,
      });
      if (out.length >= cap) break;
    }
    pageToken = plData.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Legacy (unused by the current flow) — kept for reference/back-compat. */
export async function listVideos(channelId: string, filters: EmbedFilters): Promise<VideoMeta[]> {
  if (!hasYouTube()) return mockVideos(channelId, filters.maxVideos, filters.shortsOnly);
  const all = await listChannelVideoMetaDataApi(channelId, filters.maxVideos * 2 + 10);
  const filtered = all.filter((v) => (filters.shortsOnly ? v.isShort : filters.includeVideos || v.isShort));
  return filtered.slice(0, filters.maxVideos);
}

export function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || "0", 10) * 3600 + parseInt(m[2] || "0", 10) * 60 + parseInt(m[3] || "0", 10);
}
