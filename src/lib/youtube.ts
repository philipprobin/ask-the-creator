import { config, hasYouTube } from "./config";
import type { Channel, VideoMeta, EmbedFilters } from "./types";

const API = "https://www.googleapis.com/youtube/v3";

// ---- Mock data (used when no YOUTUBE_API_KEY) ----
const MOCK_CHANNELS: Channel[] = [
  {
    id: "mock-mkbhd",
    title: "Marques Brownlee (mock)",
    description: "Quality tech videos. (mock data — set YOUTUBE_API_KEY for real search)",
    thumbnail: "https://yt3.googleusercontent.com/ytc/default.jpg",
    subscriberCount: "19000000",
    videoCount: "1700",
  },
  {
    id: "mock-veritasium",
    title: "Veritasium (mock)",
    description: "Science and engineering videos. (mock)",
    thumbnail: "https://yt3.googleusercontent.com/ytc/default.jpg",
    subscriberCount: "15000000",
    videoCount: "400",
  },
];

function mockVideos(channelId: string, filters: EmbedFilters): VideoMeta[] {
  const n = Math.min(filters.maxVideos, 8);
  return Array.from({ length: n }).map((_, i) => ({
    id: `${channelId}-vid-${i}`,
    title: `${filters.shortsOnly ? "Short" : "Video"} #${i + 1} (mock transcript)`,
    publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
    thumbnail: "https://i.ytimg.com/vi/default.jpg",
    isShort: filters.shortsOnly,
  }));
}

// ---- Real API ----
export async function searchChannels(query: string): Promise<Channel[]> {
  if (!hasYouTube()) {
    // In mock mode there is no real index, so just return the sample channels.
    return MOCK_CHANNELS;
  }

  const url = `${API}/search?part=snippet&type=channel&maxResults=8&q=${encodeURIComponent(
    query
  )}&key=${config.youtubeKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = await res.json();
  const ids: string[] = (data.items || []).map((it: any) => it.id.channelId).filter(Boolean);
  if (ids.length === 0) return [];

  // Hydrate with stats
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

export async function listVideos(channelId: string, filters: EmbedFilters): Promise<VideoMeta[]> {
  if (!hasYouTube()) return mockVideos(channelId, filters);

  // Resolve uploads playlist
  const chUrl = `${API}/channels?part=contentDetails&id=${channelId}&key=${config.youtubeKey}`;
  const chRes = await fetch(chUrl);
  const chData = await chRes.json();
  const uploads = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  const collected: VideoMeta[] = [];
  let pageToken = "";
  // Fetch a bit more than needed, then filter shorts/videos and trim.
  const target = filters.maxVideos * 2 + 10;

  while (collected.length < target) {
    const plUrl = `${API}/playlistItems?part=snippet,contentDetails&maxResults=1000&playlistId=${uploads}${
      pageToken ? `&pageToken=${pageToken}` : ""
    }&key=${config.youtubeKey}`;
    const plRes = await fetch(plUrl);
    if (!plRes.ok) break;
    const plData = await plRes.json();
    const items = plData.items || [];
    const ids = items.map((it: any) => it.contentDetails.videoId).join(",");
    if (!ids) break;

    const vUrl = `${API}/videos?part=snippet,contentDetails&id=${ids}&key=${config.youtubeKey}`;
    const vRes = await fetch(vUrl);
    const vData = await vRes.json();
    for (const v of vData.items || []) {
      const seconds = parseISODuration(v.contentDetails?.duration || "");
      const isShort = seconds > 0 && seconds <= 60;
      collected.push({
        id: v.id,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
        duration: v.contentDetails?.duration,
        isShort,
      });
    }
    pageToken = plData.nextPageToken;
    if (!pageToken) break;
  }

  const filtered = collected.filter((v) =>
    filters.shortsOnly ? v.isShort : filters.includeVideos || v.isShort
  );
  return filtered.slice(0, filters.maxVideos);
}

export function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}
