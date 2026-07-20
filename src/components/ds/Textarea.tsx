"use client";
import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, disabled = false, rows = 4, style, ...rest }: TextareaProps) {
  const [focus, setFocus] = React.useState(false);
  const border = invalid ? "var(--color-danger)" : focus ? "var(--border-focus)" : "var(--border-default)";
  return (
    <textarea
      rows={rows}
      disabled={disabled}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: "100%", padding: "12px 14px", resize: "vertical",
        fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
        lineHeight: "var(--lh-normal)", color: "var(--text-strong)",
        background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
        border: `1px solid ${border}`, borderRadius: "var(--radius-sm)",
        outline: "none", boxShadow: focus ? "var(--shadow-focus)" : "none",
        transition: "border-color .15s, box-shadow .15s", ...style,
      }}
      {...rest}
    />
  );
}
