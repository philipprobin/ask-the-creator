"use client";
import React from "react";

type Padding = "none" | "sm" | "md" | "lg";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: Padding;
}

export function Card({ children, interactive = false, padding = "md", style, ...rest }: CardProps) {
  const [hover, setHover] = React.useState(false);
  const pad = ({ none: 0, sm: "var(--space-4)", md: "var(--space-5)", lg: "var(--space-6)" } as Record<Padding, string | number>)[padding];
  return (
    <div
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        background: "var(--surface-card)", border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)", padding: pad,
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-sm)",
        cursor: interactive ? "pointer" : "default",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "box-shadow .18s ease, transform .18s ease, border-color .18s ease",
        borderColor: hover ? "var(--border-default)" : "var(--border-subtle)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: "var(--space-3)", ...style }}>{children}</div>;
}
export function CardTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--fw-bold)" as unknown as number, color: "var(--text-strong)", letterSpacing: "var(--ls-tight)", ...style }}>{children}</h3>;
}
export function CardDescription({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "4px 0 0", ...style }}>{children}</p>;
}
