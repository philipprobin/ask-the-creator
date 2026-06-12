"use client";

import { useState } from "react";
import type { Channel } from "@/lib/types";

export interface EmbedResult {
  channelId: string;
  channelTitle: string;
  videosProcessed: number;
  videosWithTranscript: number;
  chunks: number;
}

export default function EmbedPanel({
  channel,
  onBack,
  onEmbedded,
}: {
  channel: Channel;
  onBack: () => void;
  onEmbedded: (r: EmbedResult) => void;
}) {
  const [shortsOnly, setShortsOnly] = useState(false);
  const [includeVideos, setIncludeVideos] = useState(true);
  const [maxVideos, setMaxVideos] = useState(10);
  const [order, setOrder] = useState<"date" | "viewCount">("date");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");

  async function runEmbed() {
    setLoading(true);
    setError("");
    setProgress(0);
    setProgressText("");

    try {
      // Start embed (don't await immediately)
      const embedPromise = fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channel.id,
          channelTitle: channel.title,
          channelThumbnail: channel.thumbnail,
          shortsOnly,
          includeVideos,
          maxVideos,
          order,
        }),
      });

      // Poll for real status while embed is running
      let done = false;
      while (!done) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
          const statusRes = await fetch(
            `/api/embed/status?channelId=${encodeURIComponent(channel.id)}`
          );
          const status = await statusRes.json();

          if (status.total > 0) {
            const pct = Math.floor((status.processed / status.total) * 100);
            setProgress(pct);
            setProgressText(`${status.processed}/${status.total}`);
            done = status.done;
          }
        } catch (e) {
          console.error("Status poll failed", e);
        }
      }

      // Now await the actual response
      const res = await embedPromise;
      const data = await res.json();

      setProgress(100);
      setProgressText(`${data.videosProcessed}/${maxVideos}`);

      if (!res.ok) throw new Error(data.error || "Embedding fehlgeschlagen");
      onEmbedded(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setProgress(0);
        setProgressText("");
      }, 500);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-none border-none bg-black p-4 sm:rounded-xl sm:border sm:border-border sm:bg-panel sm:p-5">
      <button onClick={onBack} className="mb-4 text-sm text-neutral-400 hover:text-white">
        ← zurück
      </button>

      <div className="mb-5 flex items-center gap-3">
        {channel.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail} alt="" className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14" />
        )}
        <div>
          <div className="text-base font-semibold sm:text-lg">{channel.title}</div>
          <div className="text-xs text-neutral-500 sm:text-sm">
            {channel.videoCount ? `${channel.videoCount} Videos` : ""}
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <label className="flex items-center justify-between">
          <span className="text-sm sm:text-base">Nur Shorts</span>
          <input
            type="checkbox"
            checked={shortsOnly}
            onChange={(e) => setShortsOnly(e.target.checked)}
            className="h-4 w-4"
            disabled={loading}
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm sm:text-base">Videos includieren</span>
          <input
            type="checkbox"
            checked={includeVideos}
            onChange={(e) => setIncludeVideos(e.target.checked)}
            className="h-4 w-4"
            disabled={loading}
          />
        </label>

        <div>
          <label className="block mb-2 text-sm sm:text-base">
            Videos pro Run: <span className="font-semibold text-accent">{maxVideos}</span>
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={maxVideos}
            onChange={(e) => setMaxVideos(parseInt(e.target.value))}
            className="w-full"
            disabled={loading}
          />
          <div className="mt-1 flex justify-between text-xs text-neutral-500">
            <span>10</span>
            <span>100</span>
          </div>
        </div>

        <div>
          <label className="block text-sm sm:text-base">Sortierung</label>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as "date" | "viewCount")}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent sm:text-base"
            disabled={loading}
          >
            <option value="date">Neueste zuerst</option>
            <option value="viewCount">Meistgesehen zuerst</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Embeddet…</span>
            <span className="font-semibold text-accent">{progressText || "0%"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={runEmbed}
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50 sm:mt-6"
      >
        {loading ? "Embeddet…" : "Embedten"}
      </button>
    </div>
  );
}
