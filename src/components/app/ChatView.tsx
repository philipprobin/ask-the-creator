"use client";
import React from "react";
import type { Channel, ChatTurn, RetrievedSource } from "@/lib/types";
import { Avatar, Badge, IconButton, Textarea, Spinner, Icon, Markdown, accentFor } from "@/components/ds";
import { ytThumb } from "@/lib/media";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function SourceChip({ s, i }: { s: RetrievedSource; i: number }) {
  const [broken, setBroken] = React.useState(false);
  const t = Math.floor(s.start);
  const url = `https://www.youtube.com/watch?v=${s.videoId}&t=${t}s`;
  const accent = accentFor(s.videoId);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{
      display: "inline-flex", alignItems: "center", gap: 9, padding: "5px 12px 5px 5px",
      background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-pill)",
      textDecoration: "none", boxShadow: "var(--shadow-sm)",
    }}>
      {/* video thumbnail with a colored source-number badge */}
      <span style={{ position: "relative", width: 46, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: accent.grad, display: "grid", placeItems: "center" }}>
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ytThumb(s.videoId)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Icon name="play" size={12} color="#fff" />
        )}
        <span style={{
          position: "absolute", bottom: 2, left: 2, width: 15, height: 15, borderRadius: "50%",
          background: accent.solid, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid",
          placeItems: "center", fontFamily: "var(--font-mono)", boxShadow: "0 0 0 1.5px #fff",
        }}>{i}</span>
      </span>
      <span style={{ fontSize: 12.5, color: "var(--text-body)", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.videoTitle}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-subtle)" }}>{fmtTime(t)}</span>
    </a>
  );
}

function QuestionBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 22 }}>
      <div style={{ maxWidth: "78%", background: "var(--color-primary)", color: "#fff", padding: "12px 16px", borderRadius: "16px 16px 4px 16px", fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
    </div>
  );
}

function AnswerBubble({ creator, turn, streaming }: { creator: Channel; turn?: ChatTurn; streaming?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
      <Avatar name={creator.title} src={creator.thumbnail} size="md" ring style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>{creator.title}</span>
          <Badge tone="brand" dot>AI · from sources</Badge>
        </div>
        {streaming || !turn ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 14, padding: "4px 0" }}>
            <Spinner size={16} /> Searching {creator.title.split(" ")[0]}&apos;s videos…
          </div>
        ) : (
          <>
            <Markdown>{turn.content}</Markdown>
            {turn.sources && turn.sources.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-subtle)", marginBottom: 8 }}>Sources</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {turn.sources.map((s, i) => <SourceChip key={i} s={s} i={i + 1} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ChatView({ creator, initialQuestion }: { creator: Channel; initialQuestion?: string }) {
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const started = React.useRef(false);

  const ask = React.useCallback(async (q: string) => {
    const question = q.trim();
    if (!question || loading) return;
    setDraft("");
    setTurns((t) => [...t, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: creator.id, channelTitle: creator.title, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setTurns((t) => [...t, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch (e: any) {
      setTurns((t) => [...t, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [creator.id, creator.title, loading]);

  // Load history, then fire the initial question once.
  React.useEffect(() => {
    fetch(`/api/chat/history?channelId=${encodeURIComponent(creator.id)}`)
      .then((r) => r.json())
      .then((d) => setTurns(d.history || []))
      .catch(() => {})
      .finally(() => {
        if (initialQuestion && !started.current) {
          started.current = true;
          ask(initialQuestion);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator.id]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, loading]);

  const empty = turns.length === 0 && !loading;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px 20px" }}>
          {empty ? (
            <div style={{ textAlign: "center", paddingTop: 40 }}>
              <Avatar name={creator.title} src={creator.thumbnail} size="xl" ring style={{ margin: "0 auto" }} />
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "var(--text-strong)", marginTop: 18, letterSpacing: "-.01em" }}>Ask {creator.title}</h1>
              <p style={{ fontSize: 14.5, color: "var(--text-muted)", marginTop: 8 }}>Answers are generated only from the sources you selected.</p>
            </div>
          ) : (
            <>
              {turns.map((t, i) =>
                t.role === "user"
                  ? <QuestionBubble key={i} text={t.content} />
                  : <AnswerBubble key={i} creator={creator} turn={t} />
              )}
              {loading && <AnswerBubble creator={creator} streaming />}
            </>
          )}
        </div>
      </div>

      {/* composer */}
      <div style={{ flexShrink: 0, padding: "14px 28px 22px", background: "linear-gradient(to top, var(--surface-page) 70%, transparent)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
          <Textarea rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(draft); } }}
            placeholder={`Ask ${creator.title.split(" ")[0]} anything…`}
            style={{ paddingRight: 56, minHeight: 52, borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)", resize: "none" }} />
          <div style={{ position: "absolute", right: 8, bottom: 8 }}>
            <IconButton variant="primary" aria-label="Send" icon={<Icon name="arrow-up" size={18} />} onClick={() => ask(draft)} disabled={loading || !draft.trim()} />
          </div>
        </div>
        <div style={{ maxWidth: 720, margin: "8px auto 0", textAlign: "center", fontSize: 11.5, color: "var(--text-subtle)" }}>
          Ask the Creator can be wrong — every answer links back to its source.
        </div>
      </div>
    </div>
  );
}
