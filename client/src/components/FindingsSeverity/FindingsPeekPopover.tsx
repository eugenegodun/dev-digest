/* FindingsPeekPopover — the FindingsBadgeGroup counter as a clickable trigger
   that opens an anchored popover listing the findings (design: a floating card
   under the counter, not a centered modal). Closes on outside click. `findings`
   may load lazily — `onOpenChange` lets the caller fetch on first open; while
   loading with nothing yet, `emptyText` shows. Renders a muted "—" when there
   are no findings (no trigger). */
"use client";

import React from "react";
import type { Finding } from "@/lib/types";
import { FindingsBadgeGroup, totalFindings, type SeverityCounts } from "./FindingsBadgeGroup";
import { FindingPeekItem } from "./FindingPeekItem";

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
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  if (totalFindings(counts) === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}
      >
        <FindingsBadgeGroup counts={counts} />
      </button>
      {open && (
        <div
          role="dialog"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align]: 0,
            width,
            maxHeight: 420,
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
        </div>
      )}
    </div>
  );
}
