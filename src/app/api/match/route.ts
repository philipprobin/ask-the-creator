import { NextRequest, NextResponse } from "next/server";
import { listChannelVideoMeta } from "@/lib/youtube";
import { embed } from "@/lib/embeddings";
import { getMetaVideoIds, saveVideoMeta, scoreVideos } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

// How many of a channel's newest long-form videos and Shorts to score, per type.
// Metadata embedding is cheap (~$0.001 for 500 title+description strings with
// text-embedding-3-small), so a larger pool just means more choice. Env-tunable.
const PER_TYPE_CAP = parseInt(process.env.MATCH_CAP || "", 10) || 150;
const MAX_CAP = 500;
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
    // Which content types to include in the scoring pool (both on by default).
    const includeVideos: boolean = body.includeVideos !== false;
    const includeShorts: boolean = body.includeShorts !== false;
    const perType = Math.min(Math.max(parseInt(body.cap, 10) || PER_TYPE_CAP, 1), MAX_CAP);
    const maxVideos = includeVideos ? perType : 0;
    const maxShorts = includeShorts ? perType : 0;

    if (!channelId || !question) {
      return NextResponse.json({ error: "channelId and question required" }, { status: 400 });
    }
    if (!includeVideos && !includeShorts) {
      return NextResponse.json({ error: "select at least one of videos or shorts" }, { status: 400 });
    }

    // 1. Ensure metadata index is warm (embed new videos only).
    const existing = await getMetaVideoIds(channelId);
    const vids = await listChannelVideoMeta(channelId, { maxVideos, maxShorts });
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

    // 2. Embed the question and rank. Filter to the requested content types so
    // previously-indexed videos of a now-deselected type don't leak in.
    const [qVec] = await embed([question]);
    const all = await scoreVideos(channelId, qVec, MAX_CAP * 2);
    const ranked = all.filter((m) => (m.isShort ? includeShorts : includeVideos));

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
