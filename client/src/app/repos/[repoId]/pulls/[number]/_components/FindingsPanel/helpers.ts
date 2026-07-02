import type { FindingRecord } from "@devdigest/shared";
import type { Severity } from "@devdigest/ui";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/** Optionally drop low-confidence findings, keep only the picked severity, then
 *  sort by severity. `severityFilter` is the page-level filter (null = all). */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severityFilter: Severity | null = null,
): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  if (severityFilter) shown = shown.filter((f) => f.severity === severityFilter);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}
