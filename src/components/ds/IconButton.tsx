"use client";
import React from "react";

type Variant = "ghost" | "secondary" | "primary";
type Size = "sm" | "md" | "lg";

const sizes: Record<Size, number> = { sm: 34, md: 42, lg: 50 };

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: Variant;
  size?: Size;
}

export function IconButton({
  icon, variant = "ghost", size = "md", disabled = false, style, ...rest
}: IconButtonProps) {
  const [hover, setHover] = React.useState(false);
  const dim = sizes[size] || sizes.md;
  const styles = ({
    ghost: { bg: hover ? "var(--surface-sunken)" : "transparent", color: "var(--text-body)", border: "1px solid transparent" },
    secondary: { bg: hover ? "var(--surface-hover)" : "var(--surface-card)", color: "var(--text-strong)", border: "1px solid var(--border-default)" },
    primary: { bg: hover ? "var(--color-primary-hover)" : "var(--color-primary)", color: "#fff", border: "1px solid transparent" },
  } as const)[variant] || { bg: "transparent", color: "var(--text-body)", border: "1px solid transparent" };
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dim, height: dim, borderRadius: "var(--radius-sm)",
        background: styles.bg, color: styles.color, border: styles.border,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: "background .15s ease", ...style,
      }}
      {...rest}
    >
      {icon}
    </button>
  );
}
