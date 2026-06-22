import type { CSSProperties } from "react";

/** Co-located styles for ConfigTab (skill editor). */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", marginBottom: 20 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  enabledLabel: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  actions: { display: "flex", gap: 10, marginTop: 10, alignItems: "center" } satisfies CSSProperties,
  savedNote: { fontSize: 13, color: "var(--ok)" } satisfies CSSProperties,

  // Body editor
  editorWrap: {
    borderRadius: 7,
    border: "1px solid var(--border)",
    overflow: "hidden",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  editorHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 12,
  } satisfies CSSProperties,
  editorFilename: {
    fontSize: 12,
    color: "var(--text-secondary)",
    flex: 1,
  } satisfies CSSProperties,
  tokenChip: {
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  unsaved: {
    fontSize: 11,
    color: "var(--warn, #f5a623)",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  editorBody: {
    display: "flex",
    overflow: "auto",
  } satisfies CSSProperties,
  gutter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    padding: "8px 10px 8px 12px",
    background: "var(--bg-elevated)",
    borderRight: "1px solid var(--border)",
    userSelect: "none",
    minWidth: 42,
    flexShrink: 0,
  } satisfies CSSProperties,
  lineNumber: {
    fontSize: 12,
    lineHeight: "1.65",
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
    fontFamily: "var(--font-mono, monospace)",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    padding: "8px 12px",
    fontSize: 13,
    lineHeight: 1.65,
    fontFamily: "var(--font-mono, monospace)",
    background: "transparent",
    border: "none",
    outline: "none",
    resize: "none",
    color: "var(--text-primary)",
    width: "100%",
    minWidth: 0,
  } satisfies CSSProperties,
} as const;
