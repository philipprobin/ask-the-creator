"use client";

import { useState, useEffect } from "react";

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-neutral-500">Prüfe Zugriff...</div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">
              ask<span className="text-accent">-the-</span>creator
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Passwort erforderlich
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort eingeben"
                className="w-full rounded border border-neutral-300 px-4 py-2 focus:border-accent focus:outline-none"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}

            <button
              type="submit"
              className="w-full rounded bg-accent px-4 py-2 font-medium text-white hover:bg-accent/90"
            >
              Anmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
