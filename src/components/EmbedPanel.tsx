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
    <div className="rounded-xl border border-border bg-panel p-5">
      <button onClick={onBack} className="mb-4 text-sm text-neutral-400 hover:text-white">
        ← andere Suche
      </button>

      <div className="mb-5 flex items-center gap-3">
        {channel.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail} alt="" className="h-14 w-14 rounded-full object-cover" />
        )}
        <div>
          <div className="text-lg font-semibold">{channel.title}</div>
          <div className="text-sm text-neutral-500">
            {channel.videoCount ? `${channel.videoCount} Videos` : ""}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <span>Nur Shorts</span>
          <input
            type="checkbox"
            checked={shortsOnly}
            onChange={(e) => setShortsOnly(e.target.checked)}
            className="h-5 w-5 accent-accent"
          />
        </label>

        {!shortsOnly && (
          <label className="flex items-center justify-between">
            <span>Normale Videos einbeziehen</span>
            <input
              type="checkbox"
              checked={includeVideos}
              onChange={(e) => setIncludeVideos(e.target.checked)}
              className="h-5 w-5 accent-accent"
            />
          </label>
        )}

        <div>
          <div className="mb-1 flex justify-between">
            <span>Anzahl Videos</span>
            <span className="text-neutral-400">{maxVideos}</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={maxVideos}
            onChange={(e) => setMaxVideos(parseInt(e.target.value, 10))}
            className="w-full accent-accent"
          />
        </div>

        <label className="flex items-center justify-between">
          <span>Sortierung</span>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as "date" | "viewCount")}
            className="rounded border border-border bg-bg px-2 py-1"
          >
            <option value="date">Neueste</option>
            <option value="viewCount">Meiste Views</option>
          </select>
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-accent">{error}</p>}

      <button
        onClick={runEmbed}
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-accent py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Embetten läuft… (kann etwas dauern)" : "Embetten"}
      </button>
    </div>
  );
}
