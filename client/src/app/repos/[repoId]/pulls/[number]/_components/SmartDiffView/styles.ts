import type { CSSProperties } from "react";

/** Co-located styles for SmartDiffView (theme CSS vars only, no hard-coded colors). */
export const s = {
  /** Outer container — stacked groups with a gap. */
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  } satisfies CSSProperties,

  /** Banner shown when the core change is too large to review at once. */
  splitBanner: {
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "color-mix(in srgb, var(--warn) 10%, transparent)",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,

  splitBannerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--warn)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,

  splitBannerBody: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  } satisfies CSSProperties,

  splitList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } satisfies CSSProperties,

  splitItem: {
    fontSize: 13,
    color: "var(--text-secondary)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,

  splitItemName: {
    fontWeight: 600,
    fontFamily: "monospace",
    color: "var(--text-primary)",
  } satisfies CSSProperties,

  /** One role group (core / wiring / boilerplate). */
  group: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  } satisfies CSSProperties,

  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    cursor: "pointer",
    userSelect: "none",
  } satisfies CSSProperties,

  groupTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  groupDescription: {
    fontSize: 12,
    color: "var(--text-muted)",
    flex: 1,
  } satisfies CSSProperties,

  groupFileCount: {
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  groupFiles: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,

  /** Wrapper used when a file header has extra badges. */
  fileHeaderExtra: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 0,
    flexShrink: 0,
  } satisfies CSSProperties,

  findingsBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    border: "1px solid transparent",
  } satisfies CSSProperties,

  /** Per-line severity marker pinned to the right of the line row. */
  lineSeverityMarker: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: 99,
    flexShrink: 0,
    marginLeft: 8,
  } satisfies CSSProperties,

  /** Skeleton loading for the smart diff while data is fetching. */
  skeleton: (width: string | number): CSSProperties => ({
    height: 14,
    width,
    borderRadius: 4,
    background: "var(--bg-subtle)",
    animation: "pulse 1.5s ease-in-out infinite",
  }),

  skeletonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "8px 0",
  } satisfies CSSProperties,

  /** Fallback message when smart diff is unavailable. */
  unavailableWrap: {
    padding: "20px 0",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  } satisfies CSSProperties,

  unavailableText: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
} as const;

/** Chevron rotates 90deg when a group is open. */
export function chevronFor(open: boolean): CSSProperties {
  return {
    color: "var(--text-muted)",
    transform: open ? "rotate(90deg)" : "none",
    transition: "transform .12s",
    flexShrink: 0,
  };
}
