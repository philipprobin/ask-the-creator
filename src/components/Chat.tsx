"use client";

import { useState, useRef, useEffect } from "react";
import type { Channel, ChatTurn, RetrievedSource, EmbeddedVideo } from "@/lib/types";
import type { EmbedResult } from "./EmbedPanel";

export default function Chat({
  channel,
  result,
  onReset,
}: {
  channel: Channel;
  result: EmbedResult;
  onReset: () => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showVideos, setShowVideos] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/chat/history?channelId=${encodeURIComponent(channel.id)}`)
      .then((r) => r.json())
      .then((d) => setTurns(d.history || []))
      .catch(() => setTurns([]))
      .finally(() => setHistoryLoading(false));
  }, [channel.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channel.id,
          channelTitle: channel.title,
          question: q,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setTurns((t) => [
        ...t,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (e: any) {
      setTurns((t) => [...t, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col rounded-none sm:rounded-xl sm:border sm:border-border">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-bg px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
        {channel.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail} alt="" className="h-8 w-8 rounded-full object-cover sm:h-10 sm:w-10" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold sm:text-base">{channel.title}</div>
          <div className="text-xs text-neutral-500">
            {result.chunks} Chunks · {result.videosProcessed} Videos
          </div>
        </div>
        <button
          onClick={() => setShowVideos((v) => !v)}
          className="flex-shrink-0 text-xs text-neutral-400 hover:text-white sm:text-sm"
        >
          Videos
        </button>
        <button
          onClick={onReset}
          className="flex-shrink-0 text-xs text-neutral-400 hover:text-white sm:text-sm"
        >
          zurück
        </button>
      </div>

      {showVideos && (
        <VideoManager channel={channel} onClose={() => setShowVideos(false)} />
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:space-y-4 sm:px-4">
        {historyLoading && (
          <p className="text-center text-sm text-neutral-500">Lade Verlauf…</p>
        )}
        {!historyLoading && turns.length === 0 && (
          <p className="text-center text-sm text-neutral-500">
            Frag {channel.title} etwas — die Antwort kommt im Stil des Creators.
          </p>
        )}
        {turns.map((t, i) => (
          <Message key={i} turn={t} />
        ))}
        {loading && <p className="text-sm text-neutral-500">…denkt nach</p>}
        <div ref={endRef} />
      </div>

      <div className="flex-shrink-0 border-t border-border bg-bg px-3 py-3 sm:px-4 sm:py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Frage…"
            className="flex-1 rounded-lg border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent sm:px-4 sm:py-3 sm:text-base"
          />
          <button
            onClick={send}
            disabled={loading}
            className="flex-shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold disabled:opacity-50 sm:px-5 sm:py-3 sm:text-base"
          >
            Senden
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoManager({
  channel,
  onClose,
}: {
  channel: Channel;
  onClose: () => void;
}) {
  const [videos, setVideos] = useState<EmbeddedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [embedding, setEmbedding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [maxVideos, setMaxVideos] = useState(20);
  const [msg, setMsg] = useState("");

  function load() {
    setLoading(true);
    fetch(`/api/channels/${encodeURIComponent(channel.id)}/videos`)
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [channel.id]);

  async function embedMore() {
    setEmbedding(true);
    setMsg("");
    setProgress(0);
    setProgressText("");

    try {
      // Start embed in background (don't await yet)
      const embedPromise = fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channel.id,
          channelTitle: channel.title,
          channelThumbnail: channel.thumbnail,
          maxVideos,
          order: "date",
        }),
      });

      // Poll for status every 500ms
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
      setProgressText(`${data.newVideos || 0}/${maxVideos}`);

      if (!res.ok) throw new Error(data.error || "Fehler");
      if (data.newVideos === 0) {
        setMsg("Alle Videos embedded.");
      } else {
        setMsg(`+${data.newVideos} Videos`);
        load();
      }
    } catch (e: any) {
      setMsg(`⚠️ ${e.message}`);
    } finally {
      setEmbedding(false);
      setTimeout(() => {
        setProgress(0);
        setProgressText("");
      }, 500);
    }
  }

  return (
    <div className="border-b border-border bg-bg/50 px-3 py-3 sm:px-4 sm:py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold sm:text-sm">Videos ({videos.length})</span>
        <button onClick={onClose} className="text-xs text-neutral-400 hover:text-white">
          ✕
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500">Lade…</p>
      ) : (
        <div className="mb-3 max-h-32 space-y-1 overflow-y-auto sm:max-h-48">
          {videos.map((v) => (
            <a
              key={v.videoId}
              href={`https://www.youtube.com/watch?v=${v.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-panel sm:text-sm"
            >
              <span className="truncate text-neutral-300">{v.title}</span>
              <span className="shrink-0 text-neutral-500">{v.chunkCount}</span>
            </a>
          ))}
        </div>
      )}

      <div className="mb-3 space-y-2">
        <label className="block text-xs sm:text-sm">
          Videos: <span className="font-semibold text-accent">{maxVideos}</span>
        </label>
        <input
          type="range"
          min="10"
          max="100"
          step="10"
          value={maxVideos}
          onChange={(e) => setMaxVideos(parseInt(e.target.value))}
          className="w-full"
          disabled={embedding}
        />
      </div>

      {embedding && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Embeddet…</span>
            <span className="font-semibold text-accent">{progressText}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          onClick={embedMore}
          disabled={embedding}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold disabled:opacity-50 sm:px-4 sm:text-sm"
        >
          {embedding ? "…" : `+ ${maxVideos} Videos`}
        </button>
        {msg && <span className="text-xs text-neutral-400 sm:text-sm">{msg}</span>}
      </div>
    </div>
  );
}

function Message({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={isUser ? "text-right" : "text-left"}>
      <div
        className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm sm:rounded-2xl sm:px-4 sm:py-2 ${
          isUser ? "bg-accent text-white" : "bg-panel border border-border"
        }`}
      >
        {turn.content}
      </div>
      {turn.sources && turn.sources.length > 0 && (
        <div className="mt-2 space-y-1 text-left">
          {turn.sources.slice(0, 3).map((s, i) => (
            <SourceLink key={i} index={i + 1} source={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceLink({ index, source }: { index: number; source: RetrievedSource }) {
  const t = Math.floor(source.start);
  const url = `https://www.youtube.com/watch?v=${source.videoId}&t=${t}s`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block truncate text-xs text-neutral-400 hover:text-accent"
    >
      [{index}] {source.videoTitle} · {fmtTime(t)}
    </a>
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
