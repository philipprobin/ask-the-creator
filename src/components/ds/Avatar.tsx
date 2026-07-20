"use client";
import React from "react";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
const sizes: Record<Size, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72 };

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  src?: string;
  name?: string;
  size?: Size;
}

export function Avatar({ src, name = "", size = "md", style, ...rest }: AvatarProps) {
  const dim = sizes[size] || 40;
  const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: dim, height: dim, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      background: src ? "var(--surface-sunken)" : "var(--blue-500)",
      color: "#fff", fontWeight: "var(--fw-bold)" as unknown as number, fontSize: dim * 0.4,
      fontFamily: "var(--font-sans)", letterSpacing: "0.02em", userSelect: "none", ...style,
    }} {...rest}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (initials || "?")}
    </span>
  );
}
