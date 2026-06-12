"use client";

import { useState, useEffect } from "react";
import type { EmbeddedChannel } from "@/lib/types";

export default function CreatorLibrary({
  onOpen,
}: {
  onOpen: (c: EmbeddedChannel) => void;
}) {
  const [channels, setChannels] = useState<EmbeddedChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-neutral-500">Lade deine Creator…</p>;
  }

  if (channels.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Deine Creator
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {channels.map((c) => (
          <button
            key={c.channelId}
            onClick={() => onOpen(c)}
            className="flex items-center gap-2 rounded-lg border border-border bg-panel p-2 text-left transition hover:border-accent sm:gap-3 sm:p-3"
          >
            {c.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.thumbnail}
                alt=""
                className="h-10 w-10 rounded-full object-cover sm:h-12 sm:w-12"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg text-lg font-bold text-neutral-500 sm:h-12 sm:w-12">
                {c.title.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold sm:text-base">{c.title}</div>
              <div className="text-xs text-neutral-500">
                {c.videoCount} Videos · {c.chunkCount} Chunks
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
