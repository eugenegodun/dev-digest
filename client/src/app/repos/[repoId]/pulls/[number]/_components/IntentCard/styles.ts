import type { CSSProperties } from "react";

/** Co-located styles for IntentCard (theme CSS vars only, no hard-coded colors). */
export const s = {
  card: {
    borderRadius: 8,
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: "var(--accent)",
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

  body: {
    padding: "14px 16px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  } satisfies CSSProperties,

  intentStatement: {
    fontSize: 15,
    fontWeight: 500,
    color: "var(--text-primary)",
    lineHeight: 1.5,
  } satisfies CSSProperties,

  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
    marginBottom: 6,
  } satisfies CSSProperties,

  scopeList: {
    listStyle: "none" as const,
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  } satisfies CSSProperties,

  scopeItem: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    display: "flex",
    alignItems: "flex-start",
    gap: 6,
  } satisfies CSSProperties,

  scopeBullet: {
    flexShrink: 0,
    marginTop: 2,
    color: "var(--text-muted)",
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

  unavailableHint: {
    fontSize: 13,
    color: "var(--text-muted)",
    opacity: 0.7,
  } satisfies CSSProperties,

  skeletonLine: (width: string | number): CSSProperties => ({
    height: 14,
    width,
    borderRadius: 4,
    background: "var(--bg-subtle)",
    animation: "pulse 1.5s ease-in-out infinite",
  }),
} as const;
