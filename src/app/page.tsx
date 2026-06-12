"use client";

import { useState } from "react";
import type { Channel, EmbeddedChannel } from "@/lib/types";
import ChannelSearch from "@/components/ChannelSearch";
import EmbedPanel, { type EmbedResult } from "@/components/EmbedPanel";
import Chat from "@/components/Chat";
import CreatorLibrary from "@/components/CreatorLibrary";

type Stage = "home" | "embed" | "chat";

export default function Home() {
  const [stage, setStage] = useState<Stage>("home");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [result, setResult] = useState<EmbedResult | null>(null);

  function openCreator(c: EmbeddedChannel) {
    setChannel({
      id: c.channelId,
      title: c.title,
      description: "",
      thumbnail: c.thumbnail || "",
    });
    setResult({
      channelId: c.channelId,
      channelTitle: c.title,
      videosProcessed: c.videoCount,
      videosWithTranscript: c.videoCount,
      chunks: c.chunkCount,
    });
    setStage("chat");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">
          ask<span className="text-accent">-the-</span>creator
        </h1>
        <p className="mt-1 text-neutral-500">
          Chatte mit jedem YouTuber – auf Basis seiner eigenen Video-Transkripte.
        </p>
      </header>

      {stage === "home" && (
        <div className="space-y-8">
          <CreatorLibrary onOpen={openCreator} />
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Neuen Creator hinzufügen
            </h2>
            <ChannelSearch
              onSelect={(c) => {
                setChannel(c);
                setStage("embed");
              }}
            />
          </div>
        </div>
      )}

      {stage === "embed" && channel && (
        <EmbedPanel
          channel={channel}
          onBack={() => setStage("home")}
          onEmbedded={(r) => {
            setResult(r);
            setStage("chat");
          }}
        />
      )}

      {stage === "chat" && channel && result && (
        <Chat
          channel={channel}
          result={result}
          onReset={() => {
            setStage("home");
            setChannel(null);
            setResult(null);
          }}
        />
      )}

      <footer className="mt-10 text-center text-xs text-neutral-600">
        v1 · yt.philippsowik.de
      </footer>
    </main>
  );
}
