import { NextResponse } from "next/server";
import { hasOpenAI, hasYouTube, hasSupadata, hasDatabase, isEnvKey, config } from "@/lib/config";

export const runtime = "nodejs";

/** Which integrations are configured, and whether each key is env-managed (read-only). */
export async function GET() {
  return NextResponse.json({
    hasOpenAI: hasOpenAI(),
    hasYouTube: hasYouTube(),
    hasSupadata: hasSupadata(),
    hasDatabase: hasDatabase(),
    storageBackend: config.storageBackend,
    chatModel: config.chatModel,
    embedModel: config.embedModel,
    env: {
      openai: isEnvKey("OPENAI_API_KEY"),
      youtube: isEnvKey("YOUTUBE_API_KEY"),
      supadata: isEnvKey("SUPADATA_API_KEY"),
    },
  });
}
