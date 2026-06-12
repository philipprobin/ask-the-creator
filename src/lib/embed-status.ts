// In-memory embed status tracking
const embedStatus = new Map<string, { processed: number; total: number; done: boolean }>();

export function setEmbedStatus(
  channelId: string,
  processed: number,
  total: number,
  done: boolean
) {
  embedStatus.set(channelId, { processed, total, done });
}

export function getEmbedStatus(channelId: string) {
  return embedStatus.get(channelId) || { processed: 0, total: 0, done: false };
}
