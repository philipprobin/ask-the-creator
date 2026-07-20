/**
 * YouTube thumbnails are deterministic from the video id, so we don't need to
 * store or fetch them — construct the URL and let the <img> fall back gracefully
 * if it 404s (e.g. mock ids). `mq` = 320×180, `hq` = 480×360.
 */
export function ytThumb(videoId: string, quality: "mq" | "hq" = "mq"): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}default.jpg`;
}
