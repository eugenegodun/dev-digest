import type { CSSProperties } from "react";

/** Co-located styles for BlastRadiusCard (theme CSS vars only, no hard-coded colors). */
export const s = {
  card: {
    borderRadius: 8,
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: "var(--warning, #f59e0b)",
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px 12px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,

  headerTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  statRow: {
    display: "flex",
    gap: 24,
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap" as const,
  } satisfies CSSProperties,

  statItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  } satisfies CSSProperties,

  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text-primary)",
    lineHeight: 1,
  } satisfies CSSProperties,

  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  body: {
    padding: "14px 16px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  } satisfies CSSProperties,

  downstreamItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    paddingBottom: 14,
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,

  downstreamItemLast: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  } satisfies CSSProperties,

  symbolRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  } satisfies CSSProperties,

  symbolName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono, monospace)",
  } satisfies CSSProperties,

  symbolKind: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } satisfies CSSProperties,

  symbolFile: {
    fontSize: 12,
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono, monospace)",
  } satisfies CSSProperties,

  callerList: {
    listStyle: "none" as const,
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  } satisfies CSSProperties,

  callerItem: {
    fontSize: 12,
    color: "var(--text-secondary)",
    fontFamily: "var(--font-mono, monospace)",
    lineHeight: 1.4,
  } satisfies CSSProperties,

  tagList: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    marginTop: 2,
  } satisfies CSSProperties,

  tag: {
    fontSize: 11,
    fontWeight: 500,
    padding: "2px 7px",
    borderRadius: 4,
    background: "var(--bg-subtle)",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,

  noDownstreamText: {
    fontSize: 13,
    color: "var(--text-muted)",
    fontStyle: "italic" as const,
    padding: "4px 0",
  } satisfies CSSProperties,

  unavailableWrap: {
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  } satisfies CSSProperties,

  unavailableText: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  skeletonLine: (width: string | number): CSSProperties => ({
    height: 14,
    width,
    borderRadius: 4,
    background: "var(--bg-subtle)",
    animation: "pulse 1.5s ease-in-out infinite",
  }),
} as const;
