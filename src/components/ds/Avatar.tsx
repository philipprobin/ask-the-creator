"use client";
import React from "react";
import { accentFor } from "./palette";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
const sizes: Record<Size, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72 };

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  src?: string;
  name?: string;
  size?: Size;
  /** show a soft colored ring around the avatar */
  ring?: boolean;
}

export function Avatar({ src, name = "", size = "md", ring = false, style, ...rest }: AvatarProps) {
  const dim = sizes[size] || 40;
  const [broken, setBroken] = React.useState(false);
  const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const accent = accentFor(name || "?");
  const showImg = src && !broken;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: dim, height: dim, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      // Colorful, deterministic gradient when there's no image — no more flat blue.
      background: showImg ? "var(--surface-sunken)" : accent.grad,
      color: "#fff", fontWeight: "var(--fw-bold)" as unknown as number, fontSize: dim * 0.4,
      fontFamily: "var(--font-sans)", letterSpacing: "0.02em", userSelect: "none",
      boxShadow: ring ? `0 0 0 2px var(--surface-card), 0 0 0 4px ${accent.solid}44` : undefined,
      ...style,
    }} {...rest}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (initials || "?")}
    </span>
  );
}
