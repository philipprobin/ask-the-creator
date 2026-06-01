"use client";

import { useState } from "react";
import type { Channel } from "@/lib/types";
import ChannelSearch from "@/components/ChannelSearch";
import EmbedPanel, { type EmbedResult } from "@/components/EmbedPanel";
import Chat from "@/components/Chat";

type Stage = "search" | "embed" | "chat";

export default function Home() {
  const [stage, setStage] = useState<Stage>("search");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [result, setResult] = useState<EmbedResult | null>(null);

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

      {stage === "search" && (
        <ChannelSearch
          onSelect={(c) => {
            setChannel(c);
            setStage("embed");
          }}
        />
      )}

      {stage === "embed" && channel && (
        <EmbedPanel
          channel={channel}
          onBack={() => setStage("search")}
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
            setStage("search");
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
