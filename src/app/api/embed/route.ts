import { NextRequest, NextResponse } from "next/server";
import { listVideos } from "@/lib/youtube";
import { fetchTranscript, chunkSegments } from "@/lib/transcript";
import { embed } from "@/lib/embeddings";
import { saveChunks, channelChunkCount } from "@/lib/store";
import type { Chunk, EmbedFilters } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channelId: string = body.channelId;
    const channelTitle: string = body.channelTitle || "this creator";
    const filters: EmbedFilters = {
      shortsOnly: !!body.shortsOnly,
      includeVideos: body.includeVideos !== false,
      maxVideos: Math.min(Math.max(parseInt(body.maxVideos, 10) || 10, 1), 50),
      order: body.order === "viewCount" ? "viewCount" : "date",
    };
    if (!channelId) {
      return NextResponse.json({ error: "channelId required" }, { status: 400 });
    }

    const videos = await listVideos(channelId, filters);
    if (videos.length === 0) {
      return NextResponse.json({ error: "no videos matched filters" }, { status: 404 });
    }

    const allChunks: Chunk[] = [];
    let withTranscript = 0;
    for (const v of videos) {
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

    if (allChunks.length === 0) {
      return NextResponse.json(
        { error: "no transcripts available for these videos" },
        { status: 422 }
      );
    }

    // Embed in batches
    const batchSize = 64;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const vectors = await embed(batch.map((c) => c.text));
      batch.forEach((c, j) => (c.embedding = vectors[j]));
    }

    saveChunks(channelId, allChunks);

    return NextResponse.json({
      ok: true,
      channelId,
      channelTitle,
      videosProcessed: videos.length,
      videosWithTranscript: withTranscript,
      chunks: channelChunkCount(channelId),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "embed failed" }, { status: 500 });
  }
}
