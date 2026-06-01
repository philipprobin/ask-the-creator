export const config = {
  openaiKey: process.env.OPENAI_API_KEY || "",
  youtubeKey: process.env.YOUTUBE_API_KEY || "",
  databaseUrl: process.env.DATABASE_URL || "",
  chatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  embedModel: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
};

export const hasOpenAI = () => config.openaiKey.length > 0;
export const hasYouTube = () => config.youtubeKey.length > 0;
export const hasDatabase = () => config.databaseUrl.length > 0;

/** True when any core integration is missing -> features fall back to mock data. */
export const isMock = () => !hasOpenAI() || !hasYouTube();
