import { NextRequest, NextResponse } from "next/server";
import { fetchTranscript, chunkSegments } from "@/lib/transcript";
import { embed } from "@/lib/embeddings";
import {
  saveChunks,
  channelChunkCount,
  getEmbeddedVideoIds,
  getVideoMetaForIds,
} from "@/lib/store";
import { setEmbedStatus } from "@/lib/embed-status";
import type { Chunk } from "@/lib/types";
import type { SaveMeta } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Lazy embed: transcribe + embed ONLY the videos the user selected on the
 * SourceSelect screen. Titles/thumbs come from the video_meta cache written by
 * /api/match. Incremental — already-embedded videos are skipped.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channelId: string = body.channelId;
    const channelTitle: string = body.channelTitle || "this creator";
    const channelThumbnail: string | undefined = body.channelThumbnail;
    const videoIds: string[] = Array.isArray(body.videoIds) ? body.videoIds : [];

    if (!channelId || videoIds.length === 0) {
      return NextResponse.json({ error: "channelId and videoIds required" }, { status: 400 });
    }

    // Titles/thumbnails from the meta index (source of truth for the picked videos).
    const metas = await getVideoMetaForIds(channelId, videoIds);
    const metaById = new Map(metas.map((m) => [m.videoId, m]));

    // Incremental: skip videos already embedded for this channel.
    const alreadyEmbedded = await getEmbeddedVideoIds(channelId);
    const newIds = videoIds.filter((id) => !alreadyEmbedded.has(id));

    if (newIds.length === 0) {
      await setEmbedStatus(channelId, 0, 0, true);
      return NextResponse.json({
        ok: true,
        channelId,
        channelTitle,
        videosProcessed: 0,
        videosWithTranscript: 0,
        newVideos: 0,
        chunks: await channelChunkCount(channelId),
        skipped: [],
        message: "Alle ausgewählten Videos sind bereits embedded.",
      });
    }

    await setEmbedStatus(channelId, 0, newIds.length, false);

    const allChunks: Chunk[] = [];
    const processedVideos: SaveMeta["videos"] = [];
    const skipped: { videoId: string; reason: string }[] = [];
    let withTranscript = 0;

    for (let i = 0; i < newIds.length; i++) {
      const id = newIds[i];
      const title = metaById.get(id)?.title || id;
      const thumbnail = metaById.get(id)?.thumbnail;
      processedVideos.push({ videoId: id, title, thumbnail });

      const segs = await fetchTranscript(id, title);
      if (!segs.length) {
        skipped.push({ videoId: id, reason: "no transcript" });
        await setEmbedStatus(channelId, i + 1, newIds.length, false);
        continue;
      }
      withTranscript++;
      for (const p of chunkSegments(segs)) {
        allChunks.push({ videoId: id, videoTitle: title, text: p.text, start: p.start });
      }
      await setEmbedStatus(channelId, i + 1, newIds.length, false);
    }

    // Embed in batches
    const batchSize = 64;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const vectors = await embed(batch.map((c) => c.text));
      batch.forEach((c, j) => (c.embedding = vectors[j]));
    }

    const meta: SaveMeta = { channelTitle, channelThumbnail, videos: processedVideos };
    await saveChunks(channelId, allChunks, meta);
    await setEmbedStatus(channelId, newIds.length, newIds.length, true);

    return NextResponse.json({
      ok: true,
      channelId,
      channelTitle,
      videosProcessed: newIds.length,
      videosWithTranscript: withTranscript,
      newVideos: newIds.length,
      chunks: await channelChunkCount(channelId),
      skipped,
    });
  } catch (e: any) {
    console.error("[EMBED] Error:", e);
    return NextResponse.json({ error: e.message || "embed failed" }, { status: 500 });
  }
}
