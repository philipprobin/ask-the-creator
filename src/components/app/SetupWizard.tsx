"use client";
import React from "react";
import { Button, Icon, Spinner } from "@/components/ds";

export interface ConfigStatus {
  hasOpenAI: boolean;
  hasYouTube: boolean;
  hasSupadata: boolean;
  hasDatabase: boolean;
  storageBackend: string;
  chatModel: string;
  embedModel: string;
  env: { openai: boolean; youtube: boolean; supadata: boolean };
}

const field: React.CSSProperties = {
  width: "100%", padding: "11px 13px", fontSize: 14, fontFamily: "var(--font-mono)",
  border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
  background: "var(--surface-card)", color: "var(--text-strong)", outline: "none",
};
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginBottom: 5, display: "block" };
const hint: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", marginTop: 4 };

function KeyRow({
  title, hintText, envManaged, present, value, onChange, placeholder, children,
}: {
  title: string; hintText: React.ReactNode; envManaged: boolean; present: boolean;
  value: string; onChange: (v: string) => void; placeholder: string; children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={label}>
        {title}{" "}
        {envManaged ? (
          <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 500 }}>· via Environment</span>
        ) : present ? (
          <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 500 }}>· gesetzt</span>
        ) : null}
      </label>
      {envManaged ? (
        <div style={{ ...field, color: "var(--text-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="lock" size={13} /> aus Umgebungsvariable (nicht editierbar)
        </div>
      ) : (
        <>
          <input type="password" value={value} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)} style={field} autoComplete="off" spellCheck={false} />
          {children}
        </>
      )}
      <div style={hint}>{hintText}</div>
    </div>
  );
}

export function SetupWizard({ status, onDone }: { status: ConfigStatus; onDone: () => void }) {
  const [openai, setOpenai] = React.useState("");
  const [youtube, setYoutube] = React.useState("");
  const [supadata, setSupadata] = React.useState("");
  const [test, setTest] = React.useState<{ state: "idle" | "testing" | "ok" | "fail"; msg?: string }>({ state: "idle" });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const openaiReady = status.env.openai || status.hasOpenAI || openai.trim().length > 0;

  async function testKey() {
    if (!openai.trim()) return;
    setTest({ state: "testing" });
    try {
      const r = await fetch("/api/config/validate-openai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: openai.trim() }),
      });
      const d = await r.json();
      setTest(d.ok ? { state: "ok" } : { state: "fail", msg: d.error });
    } catch (e: any) {
      setTest({ state: "fail", msg: e.message });
    }
  }

  async function save() {
    setError(""); setSaving(true);
    try {
      const r = await fetch("/api/config/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiKey: openai, youtubeKey: youtube, supadataKey: supadata }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Speichern fehlgeschlagen");
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "var(--grad-page-tint)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--grad-brand)", display: "grid", placeItems: "center" }}>
            <Icon name="sparkles" size={17} color="#fff" />
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text-strong)", letterSpacing: "-.01em" }}>Erste Einrichtung</h1>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 22 }}>
          Ask the Creator läuft mit deinen eigenen API-Keys. Nur der OpenAI-Key ist zwingend
          für Antworten; YouTube (Kanalsuche) und Supadata (Transkripte) sind für den vollen
          Funktionsumfang empfohlen. Keys werden lokal gespeichert.
        </p>

        <KeyRow
          title="OpenAI API Key" envManaged={status.env.openai} present={status.hasOpenAI}
          value={openai} onChange={(v) => { setOpenai(v); setTest({ state: "idle" }); }}
          placeholder="sk-..."
          hintText={<>Erforderlich · Embeddings + Antworten. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "var(--text-link)" }}>Key holen ↗</a></>}
        >
          {!status.env.openai && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <Button variant="secondary" size="sm" onClick={testKey} disabled={!openai.trim() || test.state === "testing"}
                leftIcon={test.state === "testing" ? <Spinner size={13} /> : <Icon name="check" size={14} />}>
                {test.state === "testing" ? "Teste…" : "Key testen"}
              </Button>
              {test.state === "ok" && <span style={{ fontSize: 13, color: "var(--color-success)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="check" size={14} /> gültig</span>}
              {test.state === "fail" && <span style={{ fontSize: 13, color: "var(--color-danger)" }}>✗ {test.msg}</span>}
            </div>
          )}
        </KeyRow>

        <KeyRow
          title="YouTube Data API Key" envManaged={status.env.youtube} present={status.hasYouTube}
          value={youtube} onChange={setYoutube} placeholder="AIza..."
          hintText={<>Optional · Kanalsuche + Metadaten. Ohne Key läuft es keyless (youtubei.js, etwas fragiler). <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" style={{ color: "var(--text-link)" }}>Key holen ↗</a></>}
        />

        <KeyRow
          title="Supadata API Key" envManaged={status.env.supadata} present={status.hasSupadata}
          value={supadata} onChange={setSupadata} placeholder="sd_..."
          hintText={<>Empfohlen · YouTube-Transkripte (Free-Tier verfügbar). <a href="https://supadata.ai" target="_blank" rel="noreferrer" style={{ color: "var(--text-link)" }}>Key holen ↗</a></>}
        />

        {error && <div style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <Button variant="accent" size="lg" fullWidth onClick={save} disabled={!openaiReady || saving}
          leftIcon={saving ? <Spinner size={16} color="#fff" /> : <Icon name="arrow-right" size={17} />}>
          {saving ? "Speichere…" : "Speichern & loslegen"}
        </Button>
        <div style={{ fontSize: 11.5, color: "var(--text-subtle)", textAlign: "center", marginTop: 12 }}>
          Speicherort: <code style={{ fontFamily: "var(--font-mono)" }}>data/config.json</code> (git-ignored). Auf gehosteten Umgebungen bitte Environment-Variablen setzen.
        </div>
      </div>
    </div>
  );
}
