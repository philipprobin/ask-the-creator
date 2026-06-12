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
        className="w-full rounded-lg border border-border bg-panel px-3 py-3 text-sm outline-none focus:border-accent sm:px-4 sm:text-lg"
        autoFocus
      />
      {loading && <p className="mt-2 text-xs text-neutral-500 sm:text-sm">Suche…</p>}
      <div className="mt-3 space-y-2">
        {results.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-panel p-2 text-left transition hover:border-accent sm:gap-3 sm:p-3"
          >
            {c.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.thumbnail}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover sm:h-12 sm:w-12"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium sm:text-base">{c.title}</div>
              <div className="truncate text-xs text-neutral-500 sm:text-sm">
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
