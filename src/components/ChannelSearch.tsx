"use client";

import { useState, useEffect, useRef } from "react";
import type { Channel } from "@/lib/types";

export default function ChannelSearch({
  onSelect,
}: {
  onSelect: (c: Channel) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.channels || []);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [q]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="YouTuber suchen…"
        className="w-full rounded-lg border border-border bg-panel px-4 py-3 text-lg outline-none focus:border-accent"
        autoFocus
      />
      {loading && <p className="mt-2 text-sm text-neutral-500">Suche…</p>}
      <div className="mt-3 space-y-2">
        {results.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-panel p-3 text-left transition hover:border-accent"
          >
            {c.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.thumbnail}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
              />
            )}
            <div className="min-w-0">
              <div className="truncate font-medium">{c.title}</div>
              <div className="truncate text-sm text-neutral-500">
                {c.subscriberCount
                  ? `${formatCount(c.subscriberCount)} Abonnenten · `
                  : ""}
                {c.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatCount(n?: string): string {
  const num = parseInt(n || "0", 10);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num}`;
}
