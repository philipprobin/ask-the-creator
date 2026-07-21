"use client";
import React from "react";
import { Icon } from "@/components/ds";

/** Live OpenAI cost estimate for this instance (tokens × configured prices). */
export function UsageBadge() {
  const [data, setData] = React.useState<{ totalCostUsd: number; requests: number } | null>(null);

  React.useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/usage")
        .then((r) => r.json())
        .then((d) => { if (alive && !d.error) setData(d); })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const cost = data ? `$${data.totalCostUsd.toFixed(3)}` : "$0.000";
  const reqs = data?.requests ?? 0;
  return (
    <div
      title="Geschätzte OpenAI-Kosten dieser Instanz (Tokens × Modellpreise)"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}
    >
      <Icon name="zap" size={11} color="var(--color-accent)" />
      <span style={{ fontFamily: "var(--font-mono)" }}>≈ {cost}</span>
      <span style={{ color: "var(--text-subtle)" }}>· {reqs} Anfragen</span>
    </div>
  );
}
