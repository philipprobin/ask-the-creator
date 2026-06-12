import { NextRequest, NextResponse } from "next/server";
import { getEmbedStatus } from "@/lib/embed-status";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const channelId = req.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json({ error: "channelId required" }, { status: 400 });
    }

    const status = getEmbedStatus(channelId);
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed to get status" }, { status: 500 });
  }
}
