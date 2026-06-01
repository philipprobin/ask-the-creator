"use client";

import { useState, useRef, useEffect } from "react";
import type { Channel, ChatTurn, RetrievedSource } from "@/lib/types";
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
  const endRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-[80vh] flex-col rounded-xl border border-border bg-panel">
      <div className="flex items-center gap-3 border-b border-border p-4">
        {channel.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail} alt="" className="h-10 w-10 rounded-full object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{channel.title}</div>
          <div className="text-xs text-neutral-500">
            {result.chunks} Chunks aus {result.videosWithTranscript}/{result.videosProcessed} Videos
          </div>
        </div>
        <button onClick={onReset} className="text-sm text-neutral-400 hover:text-white">
          neu
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && (
          <p className="mt-10 text-center text-neutral-500">
            Frag {channel.title} etwas — die Antwort kommt im Stil des Creators,
            mit Quellen aus den Videos.
          </p>
        )}
        {turns.map((t, i) => (
          <Message key={i} turn={t} />
        ))}
        {loading && <p className="text-neutral-500">…denkt nach</p>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Frage stellen…"
            className="flex-1 rounded-lg border border-border bg-bg px-4 py-3 outline-none focus:border-accent"
          />
          <button
            onClick={send}
            disabled={loading}
            className="rounded-lg bg-accent px-5 font-semibold disabled:opacity-50"
          >
            Senden
          </button>
        </div>
      </div>
    </div>
  );
}

function Message({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={isUser ? "text-right" : "text-left"}>
      <div
        className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
          isUser ? "bg-accent text-white" : "bg-bg border border-border"
        }`}
      >
        {turn.content}
      </div>
      {turn.sources && turn.sources.length > 0 && (
        <div className="mt-2 space-y-1 text-left">
          {turn.sources.slice(0, 4).map((s, i) => (
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
