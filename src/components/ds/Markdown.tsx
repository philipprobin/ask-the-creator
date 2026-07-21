"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders LLM answer text as Markdown, styled to match the design system.
 * No raw HTML is allowed (react-markdown ignores it by default) so answer
 * text can never inject markup — safe to feed model output directly.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 15, lineHeight: 1.68, color: "var(--text-body)" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={{ margin: "0 0 10px" }}>{children}</p>,
          strong: ({ children }) => <strong style={{ fontWeight: 700, color: "var(--text-strong)" }}>{children}</strong>,
          em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
          ul: ({ children }) => <ul style={{ margin: "0 0 10px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 4 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: "0 0 10px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 4 }}>{children}</ol>,
          li: ({ children }) => <li style={{ paddingLeft: 2 }}>{children}</li>,
          h1: ({ children }) => <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)", margin: "14px 0 8px", letterSpacing: "-.01em" }}>{children}</h3>,
          h2: ({ children }) => <h3 style={{ fontSize: 16.5, fontWeight: 700, color: "var(--text-strong)", margin: "14px 0 8px", letterSpacing: "-.01em" }}>{children}</h3>,
          h3: ({ children }) => <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: "12px 0 6px" }}>{children}</h4>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-link)", textDecoration: "underline" }}>{children}</a>,
          blockquote: ({ children }) => (
            <blockquote style={{ margin: "0 0 10px", padding: "4px 0 4px 14px", borderLeft: "3px solid var(--border-default)", color: "var(--text-muted)", fontStyle: "italic" }}>{children}</blockquote>
          ),
          code: ({ children, className }) =>
            className ? (
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{children}</code>
            ) : (
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--surface-sunken)", padding: "1px 5px", borderRadius: 5 }}>{children}</code>
            ),
          pre: ({ children }) => (
            <pre style={{ margin: "0 0 10px", padding: 12, background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", overflowX: "auto", fontSize: 13, lineHeight: 1.5 }}>{children}</pre>
          ),
          hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "14px 0" }} />,
          table: ({ children }) => (
            <div style={{ overflowX: "auto", margin: "0 0 10px" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 14 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid var(--border-default)", fontWeight: 700, color: "var(--text-strong)" }}>{children}</th>,
          td: ({ children }) => <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)" }}>{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
