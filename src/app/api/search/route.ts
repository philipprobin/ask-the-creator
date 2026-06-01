import { NextRequest, NextResponse } from "next/server";
import { searchChannels } from "@/lib/youtube";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ channels: [] });
  try {
    const channels = await searchChannels(q);
    return NextResponse.json({ channels });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "search failed" }, { status: 500 });
  }
}
