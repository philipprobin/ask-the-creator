"use client";
import React from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const sizes: Record<Size, React.CSSProperties & { gap: number; height: number }> = {
  sm: { fontSize: "var(--text-sm)", padding: "0 14px", height: 34, gap: 6 },
  md: { fontSize: "var(--text-sm)", padding: "0 18px", height: 42, gap: 8 },
  lg: { fontSize: "var(--text-md)", padding: "0 24px", height: 50, gap: 10 },
};

const variants: Record<Variant, Record<string, string>> = {
  primary: { background: "var(--color-primary)", color: "var(--color-on-primary)", border: "1px solid transparent", "--hover-bg": "var(--color-primary-hover)", "--active-bg": "var(--color-primary-active)" },
  accent: { background: "var(--color-accent)", color: "#fff", border: "1px solid transparent", "--hover-bg": "var(--color-accent-hover)", "--active-bg": "var(--coral-700)" },
  secondary: { background: "var(--surface-card)", color: "var(--text-strong)", border: "1px solid var(--border-default)", "--hover-bg": "var(--surface-hover)", "--active-bg": "var(--gray-100)" },
  ghost: { background: "transparent", color: "var(--text-body)", border: "1px solid transparent", "--hover-bg": "var(--surface-sunken)", "--active-bg": "var(--gray-200)" },
  danger: { background: "var(--color-danger)", color: "#fff", border: "1px solid transparent", "--hover-bg": "#cf3d42", "--active-bg": "#b7353a" },
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  type?: "button" | "submit" | "reset";
}

export function Button({
  children, variant = "primary", size = "md", fullWidth = false,
  disabled = false, loading = false, leftIcon, rightIcon, style, ...rest
}: ButtonProps) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  const bg = active ? v["--active-bg"] : hover ? v["--hover-bg"] : v.background;
  return (
    <button
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: s.gap, height: s.height, padding: s.padding, fontSize: s.fontSize,
        fontFamily: "var(--font-sans)", fontWeight: "var(--fw-semibold)" as unknown as number,
        letterSpacing: "var(--ls-tight)", lineHeight: 1,
        borderRadius: "var(--radius-sm)", cursor: disabled || loading ? "not-allowed" : "pointer",
        background: bg, color: v.color, border: v.border,
        width: fullWidth ? "100%" : undefined,
        opacity: disabled ? 0.5 : 1,
        transition: "background .15s ease, box-shadow .15s ease, transform .05s ease",
        transform: active && !disabled ? "translateY(1px)" : "none",
        ...style,
      }}
      {...rest}
    >
      {loading && <InlineSpinner />}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

function InlineSpinner() {
  return (
    <span style={{
      width: 15, height: 15, borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.45)", borderTopColor: "#fff",
      display: "inline-block", animation: "atc-spin .7s linear infinite",
    }} />
  );
}
