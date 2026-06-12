import { NextResponse } from "next/server";
import { listChannels } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const channels = await listChannels();
    return NextResponse.json({ channels });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed to list channels" }, { status: 500 });
  }
}
