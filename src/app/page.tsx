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
    <main className="flex min-h-screen flex-col bg-black">
      <header className="border-b border-border bg-bg px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">
          ask<span className="text-accent">-the-</span>creator
        </h1>
        <p className="mt-1 text-sm text-neutral-500 sm:text-base">
          Chatte mit jedem YouTuber – auf Basis seiner eigenen Video-Transkripte.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {stage === "home" && (
          <div className="mx-auto max-w-2xl space-y-8">
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
      </div>

      <footer className="border-t border-border bg-bg px-4 py-3 text-center text-xs text-neutral-600">
        v1 · yt.philippsowik.de
      </footer>
    </main>
  );
}
