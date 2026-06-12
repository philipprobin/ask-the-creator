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
  const [error, setError] = useState("");

  async function runEmbed() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/embed", {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Embedding fehlgeschlagen");
      onEmbedded(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm sm:text-base">Videos includieren</span>
          <input
            type="checkbox"
            checked={includeVideos}
            onChange={(e) => setIncludeVideos(e.target.checked)}
            className="h-4 w-4"
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
          >
            <option value="date">Neueste zuerst</option>
            <option value="viewCount">Meistgesehen zuerst</option>
          </select>
        </div>
      </div>

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
