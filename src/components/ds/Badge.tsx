"use client";
import React from "react";

type Tone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--gray-100)", fg: "var(--gray-700)" },
  brand: { bg: "var(--blue-50)", fg: "var(--blue-700)" },
  accent: { bg: "var(--coral-50)", fg: "var(--coral-700)" },
  success: { bg: "var(--color-success-soft)", fg: "#15803d" },
  warning: { bg: "var(--color-warning-soft)", fg: "#b45309" },
  danger: { bg: "var(--color-danger-soft)", fg: "#c0333a" },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ children, tone = "neutral", dot = false, style, ...rest }: BadgeProps) {
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 10px", borderRadius: "var(--radius-pill)",
      fontSize: "var(--text-xs)", fontWeight: "var(--fw-semibold)" as unknown as number,
      letterSpacing: "var(--ls-wide)", lineHeight: 1.6,
      background: t.bg, color: t.fg, ...style,
    }} {...rest}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.fg }} />}
      {children}
    </span>
  );
}
