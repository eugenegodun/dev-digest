import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { visibleFindings } from "./helpers";

const finding = (o: Partial<FindingRecord> = {}): FindingRecord => ({
  id: "f",
  severity: "WARNING",
  category: "bug",
  title: "t",
  file: "a.ts",
  start_line: 1,
  end_line: 1,
  rationale: "r",
  suggestion: null,
  confidence: 0.9,
  kind: "finding",
  trifecta_components: null,
  evidence: null,
  review_id: "r1",
  accepted_at: null,
  dismissed_at: null,
  ...o,
});

const crit = finding({ id: "c", severity: "CRITICAL" });
const warn = finding({ id: "w", severity: "WARNING" });
const sugg = finding({ id: "s", severity: "SUGGESTION", confidence: 0.5 });

describe("visibleFindings — severityFilter", () => {
  it("returns all findings (severity-sorted) when no filter is set", () => {
    const out = visibleFindings([warn, crit, sugg], false);
    expect(out.map((f) => f.id)).toEqual(["c", "w", "s"]); // CRITICAL < WARNING < SUGGESTION
  });

  it("keeps only the picked severity", () => {
    expect(visibleFindings([warn, crit, sugg], false, "CRITICAL").map((f) => f.id)).toEqual(["c"]);
    expect(visibleFindings([warn, crit, sugg], false, "WARNING").map((f) => f.id)).toEqual(["w"]);
  });

  it("composes with hideLow (drops low-confidence, then filters)", () => {
    // sugg has confidence 0.5 (< 0.65 threshold) → dropped by hideLow before the filter.
    expect(visibleFindings([warn, crit, sugg], true, "SUGGESTION")).toEqual([]);
    expect(visibleFindings([warn, crit, sugg], true, "CRITICAL").map((f) => f.id)).toEqual(["c"]);
  });
});
