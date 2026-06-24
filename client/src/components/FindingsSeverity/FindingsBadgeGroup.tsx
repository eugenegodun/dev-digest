/* FindingsBadgeGroup — the per-severity finding counter (Critical / Warning /
   Suggestion) shown as compact icon+count badges. Used as the click trigger for
   the findings peek popover on the PR list and the detail-page run timeline.
   Renders nothing when there are no findings (caller shows a muted "—"). */
"use client";

import React from "react";
import { SeverityBadge, type Severity } from "@devdigest/ui";

/** Per-severity counts as carried on `PrMeta.findings` (latest review only). */
export type SeverityCounts = { CRITICAL: number; WARNING: number; SUGGESTION: number };

/** Display order — highest severity first, matching the findings panel. */
export const SEVERITY_ORDER = ["CRITICAL", "WARNING", "SUGGESTION"] as const;

export function totalFindings(counts: SeverityCounts | null | undefined): number {
  if (!counts) return 0;
  return counts.CRITICAL + counts.WARNING + counts.SUGGESTION;
}

/** Tally a list of findings into the three severity buckets (mirrors the
 *  server-side `rollupSeverities`). Use when counts aren't precomputed — e.g.
 *  the detail-page run rows, which derive counts from each run's findings. */
export function countsFromFindings(findings: { severity: string }[]): SeverityCounts {
  const c: SeverityCounts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) {
    if (f.severity === "CRITICAL") c.CRITICAL += 1;
    else if (f.severity === "WARNING") c.WARNING += 1;
    else if (f.severity === "SUGGESTION") c.SUGGESTION += 1;
  }
  return c;
}

export function FindingsBadgeGroup({ counts }: { counts: SeverityCounts | null | undefined }) {
  if (!counts || totalFindings(counts) === 0) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {SEVERITY_ORDER.map((sev) =>
        counts[sev] > 0 ? (
          <SeverityBadge key={sev} severity={sev as Severity} count={counts[sev]} compact />
        ) : null,
      )}
    </span>
  );
}
