import { NextRequest, NextResponse } from "next/server";
import { listVideosForChannel } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videos = await listVideosForChannel(id);
    return NextResponse.json({ videos });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed to list videos" }, { status: 500 });
  }
}
