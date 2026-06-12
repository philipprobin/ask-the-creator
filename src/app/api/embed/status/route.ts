import { NextRequest, NextResponse } from "next/server";
import { getEmbedStatus } from "@/lib/embed-status";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const channelId = req.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json({ error: "channelId required" }, { status: 400 });
    }

    console.log(`[STATUS] Checking embed status for ${channelId}`);
    const status = await getEmbedStatus(channelId);
    console.log(`[STATUS] Result:`, status);
    
    return NextResponse.json(status);
  } catch (e: any) {
    console.error(`[STATUS] Error:`, e.message);
    return NextResponse.json({ error: e.message || "failed to get status" }, { status: 500 });
  }
}
