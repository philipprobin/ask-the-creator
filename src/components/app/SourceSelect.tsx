"use client";
import React from "react";
import type { Channel, ScoredVideo } from "@/lib/types";
import { Avatar, Badge, Button, Checkbox, Spinner, Textarea, Icon } from "@/components/ds";
import { ytThumb } from "@/lib/media";
import type { BuildResult } from "./types";

const FREE_CREDITS = 180;
const CREDIT_PER_SOURCE = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fmtDuration(iso?: string): string {
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = parseInt(m[1] || "0", 10), min = parseInt(m[2] || "0", 10), s = parseInt(m[3] || "0", 10);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(min)}:${pad(s)}` : `${min}:${pad(s)}`;
}
function fmtViews(v?: string): string {
  if (!v) return "";
  const n = Number(v);
  if (!isFinite(n)) return "";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K views`;
  return `${n} views`;
}

function Thumb({ videoId, source, duration }: { videoId: string; source: "youtube" | "spotify"; duration?: string }) {
  const [broken, setBroken] = React.useState(false);
  const yt = source !== "spotify";
  const showImg = yt && !!videoId && !broken;
  return (
    <div style={{
      width: 104, height: 62, flexShrink: 0, borderRadius: 8, position: "relative",
      background: yt ? "linear-gradient(135deg,#3a4152,#0e1116)" : "linear-gradient(135deg,#1f38e0,#141f6e)",
      display: "grid", placeItems: "center", overflow: "hidden",
    }}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ytThumb(videoId)} alt="" onError={() => setBroken(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Icon name={yt ? "play" : "mic"} size={18} color="rgba(255,255,255,.92)" />
      )}
      <span style={{ position: "absolute", top: 4, left: 5, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}>
        <Icon name={yt ? "youtube" : "audio-lines"} size={13} color="#fff" />
      </span>
      {duration && (
        <span style={{
          position: "absolute", bottom: 4, right: 5, background: "rgba(0,0,0,.8)", color: "#fff",
          fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.4, padding: "1px 4px", borderRadius: 4,
        }}>{duration}</span>
      )}
    </div>
  );
}

function CreditMeter({ used, over }: { used: number; over: boolean }) {
  const pct = Math.min(100, (used / FREE_CREDITS) * 100);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>
          <Icon name="zap" size={14} color={over ? "var(--color-danger)" : "var(--color-accent)"} /> Free-tier credits
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: over ? "var(--color-danger)" : "var(--text-muted)" }}>{used} / {FREE_CREDITS}</span>
      </div>
      <div style={{ height: 8, borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: "var(--radius-pill)", background: over ? "var(--color-danger)" : "var(--color-accent)", transition: "width .25s ease" }} />
      </div>
    </div>
  );
}

const backBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: 13, marginBottom: 8, padding: 0 };

export function SourceSelect({ creator, onBack, onBuilt }: {
  creator: Channel;
  onBack: () => void;
  onBuilt: (question: string, result: BuildResult) => void;
}) {
  const [phase, setPhase] = React.useState<"ask" | "matching" | "review" | "building">("ask");
  const [question, setQuestion] = React.useState("");
  const [matches, setMatches] = React.useState<ScoredVideo[]>([]);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const [progressText, setProgressText] = React.useState("");

  const toggle = (id: string) => setSel((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const used = sel.size * CREDIT_PER_SOURCE;
  const over = used > FREE_CREDITS;

  async function findSources() {
    if (!question.trim()) return;
    setError("");
    setPhase("matching");
    try {
      const res = await fetch("/api/match", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: creator.id, channelTitle: creator.title, channelThumbnail: creator.thumbnail, question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Matching fehlgeschlagen");
      const m: ScoredVideo[] = data.matches || [];
      setMatches(m);
      setSel(new Set(m.slice(0, 20).map((x) => x.videoId)));
      setPhase("review");
    } catch (e: any) {
      setError(e.message);
      setPhase("ask");
    }
  }

  async function build() {
    setError("");
    setPhase("building");
    setProgress(0);
    setProgressText("");
    try {
      const ids = [...sel];
      const total = ids.length;
      const statusUrl = `/api/embed/status?channelId=${encodeURIComponent(creator.id)}`;
      const allSkipped: { videoId: string; reason: string }[] = [];
      let done = false, rounds = 0, lastEmbedded = -1, last: any = null;

      // Each POST processes as many videos as fit in one serverless slot, saving
      // per video. We re-invoke until `done`, so long selections span multiple
      // function invocations instead of hitting the timeout.
      while (!done && rounds < 60) {
        rounds++;
        let roundActive = true;
        // Poll status concurrently for smooth within-round progress.
        const pollLoop = (async () => {
          while (roundActive) {
            await sleep(800);
            try {
              const s = await (await fetch(statusUrl)).json();
              if (s.total > 0) {
                setProgress(Math.min(99, Math.floor((s.processed / s.total) * 100)));
                setProgressText(`${s.processed}/${s.total}`);
              }
            } catch { /* keep polling */ }
          }
        })();

        try {
          const res = await fetch("/api/embed", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId: creator.id, channelTitle: creator.title, channelThumbnail: creator.thumbnail, videoIds: ids }),
          });
          last = await res.json();
          if (!res.ok) throw new Error(last.error || "Embedding fehlgeschlagen");
        } finally {
          roundActive = false;
          await pollLoop;
        }

        done = !!last.done;
        const embedded = last.embeddedCount ?? 0;
        setProgress(done ? 100 : Math.floor((embedded / total) * 100));
        setProgressText(`${embedded}/${total}`);
        if (Array.isArray(last.skipped)) allSkipped.push(...last.skipped);

        // No-progress guard: a single video too large to finish within one slot
        // would otherwise loop forever.
        if (!done && embedded === lastEmbedded) {
          throw new Error("Ein Video ist zu groß, um im Zeitlimit verarbeitet zu werden. Bitte wähle das längste Video ab und versuche es erneut.");
        }
        lastEmbedded = embedded;
      }

      if (!done) throw new Error("Embedding hat das Rundenlimit erreicht. Bitte weniger Videos auswählen.");
      onBuilt(question.trim(), { ...(last || {}), skipped: allSkipped } as BuildResult);
    } catch (e: any) {
      setError(e.message);
      setPhase("review");
    }
  }

  // ── ask ──
  if (phase === "ask" || phase === "matching") {
    const busy = phase === "matching";
    return (
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 28px 60px" }}>
          <button onClick={onBack} style={backBtn}><Icon name="arrow-left" size={15} /> Back to creators</button>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, marginBottom: 26 }}>
            <Avatar name={creator.title} src={creator.thumbnail} size="lg" ring />
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-strong)", letterSpacing: "-.01em" }}>{creator.title}</h1>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Answers grounded in this creator&apos;s YouTube videos</div>
            </div>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 38, color: "var(--text-strong)", letterSpacing: "-.02em", lineHeight: 1.05, marginBottom: 12 }}>What do you want to ask?</h2>
          <p style={{ fontSize: 15, color: "var(--text-body)", lineHeight: 1.6, marginBottom: 20 }}>
            Describe your question. We&apos;ll match it against every title and description in {creator.title.split(" ")[0]}&apos;s library and rank the most relevant videos to base the answer on.
          </p>
          <Textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) findSources(); }}
            placeholder="e.g. How do I actually get into a flow state and stay focused for hours?"
            style={{ fontSize: 16, minHeight: 96, borderRadius: "var(--radius-lg)" }} />
          {error && <div style={{ marginTop: 12, color: "var(--color-danger)", fontSize: 13.5 }}>{error}</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>⌘ + Enter to find sources</span>
            <Button variant="accent" size="lg" disabled={!question.trim() || busy}
              leftIcon={busy ? <Spinner size={16} color="#fff" /> : <Icon name="search" size={17} />} onClick={findSources}>
              {busy ? "Matching…" : "Find matching sources"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── review / building ──
  const building = phase === "building";
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 28px 150px" }}>
        <button onClick={() => setPhase("ask")} style={backBtn} disabled={building}><Icon name="arrow-left" size={15} /> Edit question</button>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--blue-50)", border: "1px solid var(--blue-100)", borderRadius: "var(--radius-md)", padding: "12px 14px", margin: "8px 0 22px" }}>
          <Icon name="quote" size={16} color="var(--color-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 14.5, color: "var(--text-strong)", fontWeight: 500, lineHeight: 1.5 }}>{question}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)" }}>{matches.length} matching videos</h2>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 3 }}>Ranked by relevance. Deselect any you don&apos;t want to include.</p>
          </div>
          <Badge tone="success" dot>{sel.size} selected</Badge>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {matches.map((s) => {
            const on = sel.has(s.videoId);
            const dur = fmtDuration(s.duration);
            const meta = fmtViews(s.viewCount);
            const scoreTone = s.score >= 85 ? "success" : s.score >= 65 ? "brand" : s.score >= 45 ? "warning" : "neutral";
            return (
              <div key={s.videoId} onClick={() => !building && toggle(s.videoId)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: 12, cursor: building ? "default" : "pointer",
                background: "var(--surface-card)", borderRadius: "var(--radius-md)",
                border: `1px solid ${on ? "var(--color-primary)" : "var(--border-subtle)"}`,
                boxShadow: on ? "var(--shadow-sm)" : "none", opacity: on ? 1 : 0.62,
                transition: "border-color .12s, box-shadow .12s, opacity .12s",
              }}>
                <Checkbox checked={on} onChange={() => toggle(s.videoId)} />
                <Thumb videoId={s.videoId} source={s.source} duration={dur} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.title}</div>
                  {meta && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>{meta}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-subtle)" }}>{CREDIT_PER_SOURCE} cr</span>
                  <Badge tone={scoreTone}>{s.score}%</Badge>
                </div>
              </div>
            );
          })}
          {matches.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No videos matched. Try editing your question.</p>}
        </div>
        {error && <div style={{ marginTop: 14, color: "var(--color-danger)", fontSize: 13.5 }}>{error}</div>}
      </div>

      {/* sticky action bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,.9)", backdropFilter: "blur(8px)", padding: "14px 28px",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ flex: 1, maxWidth: 320 }}><CreditMeter used={used} over={over} /></div>
          <div style={{ flex: 1, textAlign: "right", fontSize: 12.5, color: over ? "var(--color-danger)" : "var(--text-muted)" }}>
            {building
              ? <>Building index… <strong style={{ fontFamily: "var(--font-mono)" }}>{progressText}</strong></>
              : over
                ? <><strong>{used - FREE_CREDITS} credits over</strong> — deselect a few sources.</>
                : <>{FREE_CREDITS - used} credits left after this.</>}
          </div>
          <Button variant="accent" size="lg" disabled={sel.size === 0 || over || building}
            leftIcon={building ? <Spinner size={16} color="#fff" /> : <Icon name="sparkles" size={17} />} onClick={build}>
            {building ? `${progress}%` : "Build & ask"}
          </Button>
        </div>
      </div>
    </div>
  );
}
