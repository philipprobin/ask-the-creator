"use client";
import React from "react";

type Size = "sm" | "md" | "lg";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: Size;
  invalid?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** style applied to the outer wrapper */
  style?: React.CSSProperties;
}

export function Input({
  size = "md", invalid = false, leftIcon, rightIcon, disabled = false, style, ...rest
}: InputProps) {
  const [focus, setFocus] = React.useState(false);
  const h = ({ sm: 34, md: 42, lg: 50 } as Record<Size, number>)[size] || 42;
  const border = invalid ? "var(--color-danger)" : focus ? "var(--border-focus)" : "var(--border-default)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, height: h,
      padding: leftIcon || rightIcon ? "0 12px" : "0 14px",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
      border: `1px solid ${border}`, borderRadius: "var(--radius-sm)",
      boxShadow: focus ? "var(--shadow-focus)" : "none",
      transition: "border-color .15s, box-shadow .15s", ...style,
    }}>
      {leftIcon && <span style={{ color: "var(--text-subtle)", display: "flex" }}>{leftIcon}</span>}
      <input
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
          color: "var(--text-strong)", height: "100%", minWidth: 0,
        }}
        {...rest}
      />
      {rightIcon && <span style={{ color: "var(--text-subtle)", display: "flex" }}>{rightIcon}</span>}
    </div>
  );
}
