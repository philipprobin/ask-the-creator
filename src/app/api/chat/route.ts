import { NextRequest, NextResponse } from "next/server";
import { embed } from "@/lib/embeddings";
import { search, hasChannel, saveChatTurn, loadChannelTranscript, recordUsage } from "@/lib/store";
import { answer } from "@/lib/chat";
import { config } from "@/lib/config";
import type { RetrievedSource } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Rough token estimate (~4 chars/token) — good enough for the routing decision. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channelId: string = body.channelId;
    const channelTitle: string = body.channelTitle || "this creator";
    const question: string = (body.question || "").trim();

    if (!channelId || !question) {
      return NextResponse.json({ error: "channelId and question required" }, { status: 400 });
    }

    if (!(await hasChannel(channelId))) {
      return NextResponse.json(
        { error: "channel not embedded yet — run embed first" },
        { status: 409 }
      );
    }

    // Default: stuff the full transcript into context (no vector search / no
    // embeddings). Fall back to RAG only when the corpus is too large to fit.
    const { text: transcript, videos } = await loadChannelTranscript(channelId);
    const tokens = estimateTokens(transcript);

    let sources: RetrievedSource[];
    let result;
    let mode: "full" | "rag";

    if (transcript && tokens <= config.llmOnlyMaxTokens) {
      mode = "full";
      // One source per video, in the same order they're numbered in the stuffed
      // transcript — so a [n] citation in the answer maps to source chip n.
      sources = videos.map((v) => ({
        videoId: v.videoId,
        videoTitle: v.videoTitle,
        start: 0,
        text: "",
        score: 1,
      }));
      result = await answer(channelTitle, question, { mode: "full", transcript });
    } else {
      mode = "rag";
      const [qVec] = await embed([question]);
      sources = await search(channelId, qVec, 6);
      result = await answer(channelTitle, question, { mode: "rag", sources });
    }
    console.log(`[CHAT] channel=${channelId} mode=${mode} ~${tokens} transcript-tokens`);

    if (result.usage) {
      try {
        await recordUsage("chat", result.usage.model, result.usage.promptTokens, result.usage.completionTokens);
      } catch (e) {
        console.warn("Failed to record chat usage:", e);
      }
    }

    // Persist both turns (best-effort).
    try {
      await saveChatTurn(channelId, { role: "user", content: question });
      await saveChatTurn(channelId, { role: "assistant", content: result.text, sources });
    } catch (e) {
      console.warn("Failed to persist chat turn:", e);
    }

    return NextResponse.json({ answer: result.text, sources, mode });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "chat failed" }, { status: 500 });
  }
}
