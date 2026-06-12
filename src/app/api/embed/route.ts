import { NextRequest, NextResponse } from "next/server";
import { listVideos } from "@/lib/youtube";
import { fetchTranscript, chunkSegments } from "@/lib/transcript";
import { embed } from "@/lib/embeddings";
import { saveChunks, channelChunkCount, getEmbeddedVideoIds } from "@/lib/store";
import type { Chunk, EmbedFilters } from "@/lib/types";
import type { SaveMeta } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channelId: string = body.channelId;
    const channelTitle: string = body.channelTitle || "this creator";
    const channelThumbnail: string | undefined = body.channelThumbnail;
    const filters: EmbedFilters = {
      shortsOnly: !!body.shortsOnly,
      includeVideos: body.includeVideos !== false,
      maxVideos: Math.min(Math.max(parseInt(body.maxVideos, 10) || 10, 1), 50),
      order: body.order === "viewCount" ? "viewCount" : "date",
    };
    if (!channelId) {
      return NextResponse.json({ error: "channelId required" }, { status: 400 });
    }

    // Fetch a larger candidate pool so we can skip already-embedded videos
    // and still reach maxVideos NEW ones.
    const candidatePool = await listVideos(channelId, {
      ...filters,
      maxVideos: Math.min(filters.maxVideos * 3, 50),
    });
    if (candidatePool.length === 0) {
      return NextResponse.json({ error: "no videos matched filters" }, { status: 404 });
    }

    // Incremental: skip videos already embedded for this channel.
    const alreadyEmbedded = await getEmbeddedVideoIds(channelId);
    const newVideos = candidatePool
      .filter((v) => !alreadyEmbedded.has(v.id))
      .slice(0, filters.maxVideos);

    if (newVideos.length === 0) {
      return NextResponse.json({
        ok: true,
        channelId,
        channelTitle,
        videosProcessed: 0,
        videosWithTranscript: 0,
        newVideos: 0,
        chunks: await channelChunkCount(channelId),
        message: "Alle passenden Videos sind bereits embedded.",
      });
    }

    const allChunks: Chunk[] = [];
    const processedVideos: SaveMeta["videos"] = [];
    let withTranscript = 0;

    for (const v of newVideos) {
      processedVideos.push({ videoId: v.id, title: v.title, thumbnail: v.thumbnail });
      const segs = await fetchTranscript(v.id, v.title);
      if (!segs.length) continue;
      withTranscript++;
      const pieces = chunkSegments(segs);
      for (const p of pieces) {
        allChunks.push({
          videoId: v.id,
          videoTitle: v.title,
          text: p.text,
          start: p.start,
        });
      }
    }

    // Embed in batches
    const batchSize = 64;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const vectors = await embed(batch.map((c) => c.text));
      batch.forEach((c, j) => (c.embedding = vectors[j]));
    }

    const meta: SaveMeta = {
      channelTitle,
      channelThumbnail,
      videos: processedVideos,
    };
    await saveChunks(channelId, allChunks, meta);

    return NextResponse.json({
      ok: true,
      channelId,
      channelTitle,
      videosProcessed: newVideos.length,
      videosWithTranscript: withTranscript,
      newVideos: newVideos.length,
      chunks: await channelChunkCount(channelId),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "embed failed" }, { status: 500 });
  }
}
