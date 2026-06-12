import { NextRequest, NextResponse } from "next/server";
import { listVideos } from "@/lib/youtube";
import { fetchTranscript, chunkSegments } from "@/lib/transcript";
import { embed } from "@/lib/embeddings";
import { saveChunks, channelChunkCount, getEmbeddedVideoIds } from "@/lib/store";
import { setEmbedStatus } from "@/lib/embed-status";
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
      maxVideos: Math.min(Math.max(parseInt(body.maxVideos, 10) || 10, 1), 100),
      order: body.order === "viewCount" ? "viewCount" : "date",
    };
    
    console.log(`[EMBED] Starting embed for ${channelId}, maxVideos=${filters.maxVideos}`);
    
    if (!channelId) {
      return NextResponse.json({ error: "channelId required" }, { status: 400 });
    }

    // Fetch a larger candidate pool so we can skip already-embedded videos
    const candidatePool = await listVideos(channelId, {
      ...filters,
      maxVideos: Math.min(filters.maxVideos * 3, 100),
    });
    console.log(`[EMBED] Found ${candidatePool.length} candidate videos`);
    
    if (candidatePool.length === 0) {
      return NextResponse.json({ error: "no videos matched filters" }, { status: 404 });
    }

    // Incremental: skip videos already embedded for this channel.
    const alreadyEmbedded = await getEmbeddedVideoIds(channelId);
    const newVideos = candidatePool
      .filter((v) => !alreadyEmbedded.has(v.id))
      .slice(0, filters.maxVideos);

    console.log(`[EMBED] ${newVideos.length} new videos to embed (${alreadyEmbedded.size} already embedded)`);

    if (newVideos.length === 0) {
      await setEmbedStatus(channelId, 0, 0, true);
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

    await setEmbedStatus(channelId, 0, newVideos.length, false);
    console.log(`[EMBED] Set initial status: 0/${newVideos.length}`);

    const allChunks: Chunk[] = [];
    const processedVideos: SaveMeta["videos"] = [];
    let withTranscript = 0;

    for (let i = 0; i < newVideos.length; i++) {
      const v = newVideos[i];
      processedVideos.push({ videoId: v.id, title: v.title, thumbnail: v.thumbnail });

      console.log(`[EMBED] Processing video ${i + 1}/${newVideos.length}: ${v.title}`);
      const segs = await fetchTranscript(v.id, v.title);
      if (!segs.length) {
        console.log(`[EMBED] No transcript for ${v.id}`);
        await setEmbedStatus(channelId, i + 1, newVideos.length, false);
        continue;
      }
      withTranscript++;

      const pieces = chunkSegments(segs);
      console.log(`[EMBED] Split into ${pieces.length} chunks`);
      
      for (const p of pieces) {
        allChunks.push({
          videoId: v.id,
          videoTitle: v.title,
          text: p.text,
          start: p.start,
        });
      }

      await setEmbedStatus(channelId, i + 1, newVideos.length, false);
      console.log(`[EMBED] Updated status: ${i + 1}/${newVideos.length}`);
    }

    console.log(`[EMBED] Total chunks: ${allChunks.length}, transcripts: ${withTranscript}`);

    // Embed in batches
    const batchSize = 64;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      console.log(`[EMBED] Embedding batch ${i}-${i + batch.length}`);
      const vectors = await embed(batch.map((c) => c.text));
      batch.forEach((c, j) => (c.embedding = vectors[j]));
    }

    const meta: SaveMeta = {
      channelTitle,
      channelThumbnail,
      videos: processedVideos,
    };
    console.log(`[EMBED] Saving to DB...`);
    await saveChunks(channelId, allChunks, meta);

    await setEmbedStatus(channelId, newVideos.length, newVideos.length, true);
    console.log(`[EMBED] Complete!`);

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
    console.error(`[EMBED] Error:`, e);
    return NextResponse.json({ error: e.message || "embed failed" }, { status: 500 });
  }
}
