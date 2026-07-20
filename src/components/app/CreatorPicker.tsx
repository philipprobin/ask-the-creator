"use client";
import React from "react";
import type { Channel, EmbeddedChannel } from "@/lib/types";
import { Card, Avatar, Badge, Input, Spinner, Icon } from "@/components/ds";

function SourceDots() {
  // YouTube wired now; Spotify is a structural (disabled) slot.
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <Badge tone="danger">YouTube</Badge>
      <Badge tone="neutral" style={{ opacity: 0.5 }}>Spotify soon</Badge>
    </div>
  );
}

function CreatorCard({ title, handle, subtitle, thumbnail, onClick }: {
  title: string; handle?: string; subtitle?: string; thumbnail?: string; onClick: () => void;
}) {
  return (
    <Card interactive padding="md" onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Avatar name={title} src={thumbnail} size="lg" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          {handle && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{handle}</div>}
        </div>
      </div>
      {subtitle && <div style={{ fontSize: 13, color: "var(--text-body)", marginBottom: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SourceDots />
      </div>
    </Card>
  );
}

export function CreatorPicker({ onPick }: { onPick: (c: Channel) => void }) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Channel[]>([]);
  const [library, setLibrary] = React.useState<EmbeddedChannel[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/channels").then((r) => r.json()).then((d) => setLibrary(d.channels || [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.channels || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const showLibrary = q.trim().length < 2 && library.length > 0;

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "56px 28px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 52, color: "var(--text-strong)", letterSpacing: "-.02em", lineHeight: 1.02 }}>
            Who do you want to<br />ask today?
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", marginTop: 14 }}>
            Pick a creator. We&apos;ll pull answers straight from their videos.
          </p>
          <div style={{ maxWidth: 440, margin: "22px auto 0" }}>
            <Input size="lg" placeholder="Search any YouTube channel…" value={q} onChange={(e) => setQ(e.target.value)}
              leftIcon={<Icon name="search" size={18} />}
              rightIcon={searching ? <Spinner size={16} /> : undefined} />
          </div>
        </div>

        {showLibrary && (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-subtle)", marginBottom: 12 }}>Your creators</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 34 }}>
              {library.map((c) => (
                <CreatorCard key={c.channelId} title={c.title} thumbnail={c.thumbnail}
                  subtitle={`${c.videoCount} videos · ${c.chunkCount} chunks indexed`}
                  onClick={() => onPick({ id: c.channelId, title: c.title, description: "", thumbnail: c.thumbnail || "" })} />
              ))}
            </div>
          </>
        )}

        {q.trim().length >= 2 && (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-subtle)", marginBottom: 12 }}>
              {searching ? "Searching…" : `${results.length} channels`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {results.map((c) => (
                <CreatorCard key={c.id} title={c.title} thumbnail={c.thumbnail}
                  subtitle={c.videoCount ? `${Number(c.videoCount).toLocaleString()} videos` : undefined}
                  onClick={() => onPick(c)} />
              ))}
            </div>
            {!searching && results.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, marginTop: 20 }}>No channels found.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
