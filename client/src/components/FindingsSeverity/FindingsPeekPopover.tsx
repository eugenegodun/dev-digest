/* FindingsPeekPopover — the FindingsBadgeGroup counter as a clickable trigger
   that opens an anchored popover listing the findings (design: a floating card
   under the counter, not a centered modal). Closes on outside click. `findings`
   may load lazily — `onOpenChange` lets the caller fetch on first open; while
   loading with nothing yet, `emptyText` shows. Renders a muted "—" when there
   are no findings (no trigger). */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { Finding } from "@/lib/types";
import { FindingsBadgeGroup, totalFindings, type SeverityCounts } from "./FindingsBadgeGroup";
import { FindingPeekItem } from "./FindingPeekItem";

/** Tallest the popover ever gets — also the height we budget when deciding
 *  whether to open downward or flip above the trigger. */
const MAX_POPOVER_HEIGHT = 420;
/** Gap between the trigger and the popover, and the viewport edge padding. */
const GAP = 6;

/** Fixed-position style for the portaled dialog, anchored to the trigger rect.
 *  `align` picks the horizontal edge; we flip vertically when there isn't room
 *  below, and clamp the height to the chosen side so it never leaves the viewport. */
function computePosition(rect: DOMRect, align: "left" | "right"): React.CSSProperties {
  const spaceBelow = window.innerHeight - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;
  const flipUp = spaceBelow < MAX_POPOVER_HEIGHT && spaceAbove > spaceBelow;

  const horizontal: React.CSSProperties =
    align === "right"
      ? { right: window.innerWidth - rect.right }
      : { left: rect.left };
  const vertical: React.CSSProperties = flipUp
    ? { bottom: window.innerHeight - rect.top + GAP }
    : { top: rect.bottom + GAP };

  return {
    ...horizontal,
    ...vertical,
    maxHeight: Math.min(MAX_POPOVER_HEIGHT, flipUp ? spaceAbove : spaceBelow),
  };
}

export function FindingsPeekPopover({
  counts,
  findings,
  title,
  loading,
  emptyText,
  onOpenChange,
  align = "left",
  width = 460,
}: {
  counts: SeverityCounts | null | undefined;
  findings: Finding[];
  /** Popover header, e.g. "6 findings" / "2 findings in this run" (caller i18n). */
  title: string;
  loading?: boolean;
  /** Shown when open with no findings yet (loading) — e.g. "Loading…". */
  emptyText?: string;
  /** Fired on open/close so callers can lazily fetch the findings. */
  onOpenChange?: (open: boolean) => void;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<React.CSSProperties | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Close on a click outside BOTH the trigger wrapper and the (portaled) dialog —
  // the dialog lives in document.body, so it isn't inside `ref`.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
      onOpenChange?.(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  // Anchor the fixed-position dialog to the trigger; re-measure on scroll/resize
  // (the page scrolls, so the trigger moves relative to the viewport).
  React.useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) setPos(computePosition(rect, align));
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, align]);

  if (totalFindings(counts) === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div ref={ref} style={{ display: "inline-block" }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}
      >
        <FindingsBadgeGroup counts={counts} />
      </button>
      {open &&
        createPortal(
        <div
          role="dialog"
          ref={popoverRef}
          style={{
            position: "fixed",
            ...pos,
            width,
            overflowY: "auto",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: 9,
            boxShadow: "var(--shadow-modal)",
            zIndex: 40,
            animation: "ddpop .12s ease",
            cursor: "default",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {title}
          </div>
          {findings.length === 0 ? (
            <div
              style={{
                padding: "10px 12px",
                fontSize: 12.5,
                color: "var(--text-muted)",
                borderTop: "1px solid var(--border)",
              }}
            >
              {loading ? (emptyText ?? "Loading…") : (emptyText ?? "No findings.")}
            </div>
          ) : (
            findings.map((f) => <FindingPeekItem key={f.id} f={f} />)
          )}
        </div>,
          document.body,
        )}
    </div>
  );
}
