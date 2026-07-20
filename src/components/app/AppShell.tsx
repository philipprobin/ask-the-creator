"use client";
import React from "react";
import { Avatar, Badge, Button, Icon, accentFor } from "@/components/ds";

export function Logo({ size = 22, onClick }: { size?: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 9, cursor: onClick ? "pointer" : "default", userSelect: "none" }}>
      <span style={{
        width: size + 8, height: size + 8, borderRadius: 9, flexShrink: 0,
        background: "var(--color-primary)", color: "#fff",
        display: "grid", placeItems: "center", boxShadow: "var(--shadow-sm)",
      }}>
        <Icon name="sparkles" size={size - 5} />
      </span>
      <span style={{ fontFamily: "var(--font-display)", fontSize: size, color: "var(--text-strong)", lineHeight: 1, letterSpacing: "-.01em", paddingBottom: 2 }}>
        Ask the Creator
      </span>
    </div>
  );
}

function NavItem({ label, active, dotColor, onClick }: { label: string; active?: boolean; dotColor?: string; onClick?: () => void }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
        padding: "9px 12px", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
        fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: active ? 600 : 500,
        color: active ? "var(--color-primary)" : "var(--text-body)",
        background: active ? "var(--blue-50)" : hover ? "var(--surface-sunken)" : "transparent",
        transition: "background .12s",
      }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: dotColor || "var(--gray-400)", boxShadow: active ? `0 0 0 3px ${dotColor}22` : undefined }} />
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </button>
  );
}

export interface Recent { id: string; title: string }

export function AppShell({
  children, recents = [], activeId, onHome, onNew, onSelectRecent,
}: {
  children: React.ReactNode;
  recents?: Recent[];
  activeId?: string | null;
  onHome?: () => void;
  onNew?: () => void;
  onSelectRecent?: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", height: "100dvh", background: "var(--surface-page)", fontFamily: "var(--font-sans)" }}>
      <aside style={{
        width: 264, flexShrink: 0, borderRight: "1px solid var(--border-subtle)",
        background: "var(--surface-card)", display: "flex", flexDirection: "column", padding: "18px 14px",
      }}>
        <div style={{ padding: "0 4px 16px" }}><Logo size={19} onClick={onHome} /></div>
        <Button variant="primary" fullWidth leftIcon={<Icon name="plus" size={16} />} onClick={onNew} style={{ marginBottom: 18 }}>New question</Button>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-subtle)", padding: "0 8px 8px" }}>Your creators</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
          {recents.length === 0 && <div style={{ padding: "0 12px", fontSize: 12.5, color: "var(--text-subtle)" }}>None yet</div>}
          {recents.map((r) => (
            <NavItem key={r.id} label={r.title} active={activeId === r.id} dotColor={accentFor(r.title).solid} onClick={() => onSelectRecent?.(r.id)} />
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 2px" }}>
            <Avatar name="You" size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>You</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Free plan</div>
            </div>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </main>
    </div>
  );
}

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header style={{
      height: 64, flexShrink: 0, borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-card)",
      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px",
    }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", letterSpacing: "-.01em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}
