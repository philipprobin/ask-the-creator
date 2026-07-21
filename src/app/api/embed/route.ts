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
import { hasOpenAI, hasSupadata } from "@/lib/config";
import type { Chunk } from "@/lib/types";
import type { SaveMeta } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

// Serverless functions are killed at `maxDuration`. We process videos until this
// soft budget is hit, save what's done, and report `done:false` so the client
// re-invokes to continue. Leaves headroom for the in-flight video + save.
const BUDGET_MS = 40_000;
const EMBED_BATCH = 64;

/**
 * Lazy, RESUMABLE embed. Transcribes + embeds ONLY the selected videos, saving
 * each video's chunks immediately so partial progress survives a timeout. Sends
 * the full selection every call; already-embedded videos are skipped, so the
 * client can POST repeatedly until `done` to span multiple function invocations.
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

    // Real mode needs a transcript source. Without a Supadata key every video
    // would be skipped and produce an empty index — fail fast with a clear hint
    // instead. (Mock mode, i.e. no OpenAI key, generates demo transcripts.)
    if (hasOpenAI() && !hasSupadata()) {
      return NextResponse.json(
        { error: "Kein Supadata-Key gesetzt — Transkripte können nicht geladen werden. Trage in den Einstellungen (⚙) einen Supadata-Key ein." },
        { status: 400 }
      );
    }

    const total = videoIds.length;

    // Titles/thumbnails from the meta index (source of truth for the picked videos).
    const metas = await getVideoMetaForIds(channelId, videoIds);
    const metaById = new Map(metas.map((m) => [m.videoId, m]));

    // Resume point: which of the selection still need embedding.
    const alreadyEmbedded = await getEmbeddedVideoIds(channelId);
    const newIds = videoIds.filter((id) => !alreadyEmbedded.has(id));
    let embeddedCount = total - newIds.length; // done in previous rounds

    if (newIds.length === 0) {
      await setEmbedStatus(channelId, total, total, true);
      return NextResponse.json({
        ok: true, done: true, channelId, channelTitle,
        embeddedCount: total, total, remaining: 0,
        videosProcessed: total, videosWithTranscript: 0,
        chunks: await channelChunkCount(channelId), skipped: [],
      });
    }

    await setEmbedStatus(channelId, embeddedCount, total, false);

    const start = Date.now();
    const skipped: { videoId: string; reason: string }[] = [];
    let withTranscript = 0;

    for (const id of newIds) {
      // Stop before starting a new video if we're near the function limit;
      // the client will re-invoke and resume from here.
      if (Date.now() - start > BUDGET_MS) break;

      const title = metaById.get(id)?.title || id;
      const thumbnail = metaById.get(id)?.thumbnail;

      const segs = await fetchTranscript(id, title);
      const videoMeta: SaveMeta["videos"] = [{ videoId: id, title, thumbnail }];

      if (!segs.length) {
        skipped.push({ videoId: id, reason: "no transcript" });
        // Persist the (empty) video row so it counts as done and isn't retried.
        await saveChunks(channelId, [], { channelTitle, channelThumbnail, videos: videoMeta });
      } else {
        withTranscript++;
        const chunks: Chunk[] = chunkSegments(segs).map((p) => ({
          videoId: id, videoTitle: title, text: p.text, start: p.start,
        }));
        for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
          const batch = chunks.slice(i, i + EMBED_BATCH);
          const vectors = await embed(batch.map((c) => c.text));
          batch.forEach((c, j) => (c.embedding = vectors[j]));
        }
        await saveChunks(channelId, chunks, { channelTitle, channelThumbnail, videos: videoMeta });
      }

      embeddedCount++;
      await setEmbedStatus(channelId, embeddedCount, total, false);
    }

    const remaining = total - embeddedCount;
    const done = remaining === 0;
    await setEmbedStatus(channelId, embeddedCount, total, done);

    return NextResponse.json({
      ok: true, done, channelId, channelTitle,
      embeddedCount, total, remaining,
      videosProcessed: embeddedCount,
      videosWithTranscript: withTranscript,
      chunks: await channelChunkCount(channelId),
      skipped,
    });
  } catch (e: any) {
    console.error("[EMBED] Error:", e);
    return NextResponse.json({ error: e.message || "embed failed" }, { status: 500 });
  }
}
