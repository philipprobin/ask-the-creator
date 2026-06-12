import { NextRequest, NextResponse } from "next/server";
import { getChatHistory } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const channelId = req.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json({ error: "channelId required" }, { status: 400 });
    }
    const history = await getChatHistory(channelId);
    return NextResponse.json({ history });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed to load history" }, { status: 500 });
  }
}
