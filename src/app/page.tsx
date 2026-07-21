"use client";

import { useState, useEffect, useCallback } from "react";
import type { Channel, EmbeddedChannel } from "@/lib/types";
import { AppShell, TopBar } from "@/components/app/AppShell";
import { CreatorPicker } from "@/components/app/CreatorPicker";
import { SourceSelect } from "@/components/app/SourceSelect";
import { ChatView } from "@/components/app/ChatView";
import { SetupWizard, type ConfigStatus } from "@/components/app/SetupWizard";
import { Badge } from "@/components/ds";

type Stage = "pick" | "source" | "chat";

export default function Home() {
  const [stage, setStage] = useState<Stage>("pick");
  const [creator, setCreator] = useState<Channel | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [library, setLibrary] = useState<EmbeddedChannel[]>([]);

  const [setup, setSetup] = useState<ConfigStatus | "ok" | null>(null);
  const [status, setStatus] = useState<ConfigStatus | null>(null); // last fetched, for the settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshLibrary = useCallback(() => {
    fetch("/api/channels").then((r) => r.json()).then((d) => setLibrary(d.channels || [])).catch(() => {});
  }, []);
  useEffect(() => { refreshLibrary(); }, [refreshLibrary]);

  const checkSetup = useCallback(() => {
    fetch("/api/config/status")
      .then((r) => r.json())
      .then((s: ConfigStatus) => { setStatus(s); setSetup(s.hasOpenAI ? "ok" : s); })
      .catch(() => setSetup("ok")); // don't block the app if the check fails
  }, []);
  useEffect(() => { checkSetup(); }, [checkSetup]);

  const openSettings = () => { checkSetup(); setSettingsOpen(true); };

  const home = () => { setStage("pick"); setCreator(null); setQuestion(""); refreshLibrary(); };
  const pick = (c: Channel) => { setCreator(c); setQuestion(""); setStage("source"); };
  const built = (q: string) => { setQuestion(q); setStage("chat"); refreshLibrary(); };
  const openRecent = (id: string) => {
    const c = library.find((x) => x.channelId === id);
    if (!c) return;
    setCreator({ id: c.channelId, title: c.title, description: "", thumbnail: c.thumbnail || "" });
    setQuestion("");
    setStage("chat");
  };

  if (setup === null) return null; // checking config
  if (setup !== "ok") return <SetupWizard status={setup} onDone={checkSetup} />;

  let body: React.ReactNode, title = "Discover", subtitle: string | undefined, right: React.ReactNode = null;
  if (stage === "pick") {
    title = "Discover"; subtitle = "Choose a creator to ask";
    body = <CreatorPicker onPick={pick} />;
  } else if (stage === "source" && creator) {
    title = "Set up sources"; subtitle = creator.title;
    body = <SourceSelect creator={creator} onBack={home} onBuilt={built} />;
  } else if (stage === "chat" && creator) {
    title = creator.title; subtitle = "Answering from selected sources";
    right = <Badge tone="success" dot>Index ready</Badge>;
    body = <ChatView creator={creator} initialQuestion={question || undefined} />;
  }

  return (
    <AppShell
      recents={library.map((c) => ({ id: c.channelId, title: c.title }))}
      activeId={creator?.id}
      onHome={home}
      onNew={home}
      onSelectRecent={openRecent}
      onSettings={openSettings}
    >
      <TopBar title={title} subtitle={subtitle} right={right} />
      <div style={{ flex: 1, position: "relative", minHeight: 0, display: "flex", flexDirection: "column" }}>{body}</div>
      {settingsOpen && status && (
        <SetupWizard
          status={status}
          onDone={() => { checkSetup(); setSettingsOpen(false); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </AppShell>
  );
}
