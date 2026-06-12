import { NextRequest, NextResponse } from "next/server";
import { embed } from "@/lib/embeddings";
import { search, hasChannel } from "@/lib/store";
import { answer } from "@/lib/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channelId: string = body.channelId;
    const channelTitle: string = body.channelTitle || "this creator";
    const question: string = (body.question || "").trim();

    if (!channelId || !question) {
      return NextResponse.json({ error: "channelId and question required" }, { status: 400 });
    }
    
    const hasEmbeddings = await hasChannel(channelId);
    if (!hasEmbeddings) {
      return NextResponse.json(
        { error: "channel not embedded yet — run embed first" },
        { status: 409 }
      );
    }

    const [qVec] = await embed([question]);
    const sources = await search(channelId, qVec, 6);
    const text = await answer(channelTitle, question, sources);

    return NextResponse.json({ answer: text, sources });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "chat failed" }, { status: 500 });
  }
}
