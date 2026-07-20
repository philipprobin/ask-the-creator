"use client";
import React from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: React.ReactNode;
}

export function Checkbox({ checked, defaultChecked, onChange, label, disabled = false, ...rest }: CheckboxProps) {
  const [internal, setInternal] = React.useState(defaultChecked || false);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const toggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <span style={{
        width: 20, height: 20, borderRadius: "var(--radius-xs)", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: on ? "var(--color-primary)" : "var(--surface-card)",
        border: on ? "1px solid var(--color-primary)" : "1px solid var(--border-default)",
        transition: "background .15s, border-color .15s",
      }}>
        {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
      </span>
      <input type="checkbox" checked={on} disabled={disabled} onChange={toggle} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} {...rest} />
      {label && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-body)" }}>{label}</span>}
    </label>
  );
}
