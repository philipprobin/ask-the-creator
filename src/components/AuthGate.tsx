"use client";

import { useState, useEffect } from "react";
import { Card, Input, Button, Icon } from "@/components/ds";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already authed in sessionStorage
    if (typeof window !== "undefined") {
      const authed = sessionStorage.getItem("auth") === "true";
      setIsAuthed(authed);
      setChecking(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        sessionStorage.setItem("auth", "true");
        setIsAuthed(true);
      } else {
        const data = await res.json();
        setError(data.error || "Falsches Passwort");
        setPassword("");
      }
    } catch {
      setError("Verbindungsfehler");
    }
  };

  if (checking) {
    return (
      <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", background: "var(--surface-page)", color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: 14 }}>
        Prüfe Zugriff…
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--surface-page)", fontFamily: "var(--font-sans)" }}>
        <Card padding="lg" style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <span style={{ width: 44, height: 44, borderRadius: 11, background: "var(--color-primary)", color: "#fff", display: "inline-grid", placeItems: "center", boxShadow: "var(--shadow-sm)", marginBottom: 14 }}>
              <Icon name="sparkles" size={22} />
            </span>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text-strong)", letterSpacing: "-.01em" }}>Ask the Creator</h1>
            <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-muted)" }}>Passwort erforderlich</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben"
              size="lg"
              autoFocus
              invalid={!!error}
            />
            {error && <div style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</div>}
            <Button type="submit" variant="primary" size="lg" fullWidth>Anmelden</Button>
          </form>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
