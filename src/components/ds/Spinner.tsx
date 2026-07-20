"use client";
import React from "react";

export interface SpinnerProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function Spinner({ size = 20, color = "var(--color-primary)", style }: SpinnerProps) {
  return (
    <span role="status" aria-label="Loading" style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      border: `${Math.max(2, size / 10)}px solid var(--gray-200)`, borderTopColor: color,
      animation: "atc-spin .7s linear infinite", ...style,
    }} />
  );
}
