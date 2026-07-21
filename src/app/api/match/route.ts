import { NextRequest, NextResponse } from "next/server";
import { listChannelVideoMeta } from "@/lib/youtube";
import { embed } from "@/lib/embeddings";
import { getMetaVideoIds, saveVideoMeta, scoreVideos } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

// How many of a channel's newest videos to score. Metadata embedding is cheap
// (~$0.001 for 500 title+description strings with text-embedding-3-small), so a
// larger pool just means more choice on the review screen. Configurable via env.
const DEFAULT_CAP = parseInt(process.env.MATCH_CAP || "", 10) || 300;
const MAX_CAP = 1000;
const EMBED_BATCH = 64;

/**
 * Question-first matching. Ensures the channel's video metadata (title +
 * description) is embedded & cached (once per channel, incremental for new
 * uploads), then ranks all videos by cosine similarity to the question.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channelId: string = body.channelId;
    const channelTitle: string = body.channelTitle || "this creator";
    const channelThumbnail: string | undefined = body.channelThumbnail;
    const question: string = (body.question || "").trim();
    const cap: number = Math.min(Math.max(parseInt(body.cap, 10) || DEFAULT_CAP, 1), MAX_CAP);

    if (!channelId || !question) {
      return NextResponse.json({ error: "channelId and question required" }, { status: 400 });
    }

    // 1. Ensure metadata index is warm (embed new videos only).
    const existing = await getMetaVideoIds(channelId);
    const vids = await listChannelVideoMeta(channelId, cap);
    if (vids.length === 0 && existing.size === 0) {
      return NextResponse.json({ error: "no videos found for this channel" }, { status: 404 });
    }
    const newVids = vids.filter((v) => !existing.has(v.id));
    if (newVids.length > 0) {
      const rows: (typeof newVids[number] & { embedding: number[] })[] = [];
      for (let i = 0; i < newVids.length; i += EMBED_BATCH) {
        const batch = newVids.slice(i, i + EMBED_BATCH);
        const vectors = await embed(batch.map((v) => `${v.title}\n${v.description ?? ""}`.trim()));
        batch.forEach((v, j) => rows.push({ ...v, embedding: vectors[j] }));
      }
      await saveVideoMeta(channelId, { channelTitle, channelThumbnail }, rows);
    }

    // 2. Embed the question and rank.
    const [qVec] = await embed([question]);
    const ranked = await scoreVideos(channelId, qVec, cap);

    // Display rescale: real embedding cosines compress into a narrow high-teens/
    // twenties band. Normalize relative to the channel's best match so the % spread
    // is legible (best ≈ 99), while preserving the true ranking order.
    const top = Math.max(1, ...ranked.map((m) => m.score));
    const matches = ranked.map((m) => ({ ...m, score: Math.round((m.score / top) * 99) }));

    return NextResponse.json({
      channelId,
      question,
      metaIndexed: true,
      count: matches.length,
      matches,
    });
  } catch (e: any) {
    console.error("[MATCH] Error:", e);
    return NextResponse.json({ error: e.message || "match failed" }, { status: 500 });
  }
}
