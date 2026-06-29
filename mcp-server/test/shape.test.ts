import { describe, expect, it } from "vitest";

import type { ReviewDto, ReviewFinding } from "../src/api/types.js";
import { mapReviewToConcise } from "../src/shape/findings.js";

function finding(over: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    severity: "WARNING",
    category: "bug",
    title: "t",
    file: "a.ts",
    start_line: 1,
    end_line: 2,
    rationale: "why",
    suggestion: "fix",
    ...over,
  };
}

function review(findings: ReviewFinding[]): ReviewDto {
  return {
    id: "rev1",
    pr_id: "pr1",
    run_id: "run1",
    kind: "review",
    verdict: "request_changes",
    summary: "s",
    score: 42,
    created_at: "2026-01-01T00:00:00.000Z",
    findings,
  };
}

describe("mapReviewToConcise", () => {
  it("keeps only the whitelisted finding fields", () => {
    const out = mapReviewToConcise(review([finding()]));
    expect(Object.keys(out.findings[0]!).sort()).toEqual(
      [
        "category",
        "end_line",
        "file",
        "rationale",
        "severity",
        "start_line",
        "suggestion",
        "title",
      ].sort(),
    );
    // dropped verbose fields are absent
    expect("confidence" in out.findings[0]!).toBe(false);
    expect("id" in out.findings[0]!).toBe(false);
    expect("evidence" in out.findings[0]!).toBe(false);
  });

  it("sorts by severity CRITICAL → WARNING → SUGGESTION", () => {
    const out = mapReviewToConcise(
      review([
        finding({ severity: "SUGGESTION", title: "s" }),
        finding({ severity: "CRITICAL", title: "c" }),
        finding({ severity: "WARNING", title: "w" }),
      ]),
    );
    expect(out.findings.map((f) => f.title)).toEqual(["c", "w", "s"]);
  });

  it("caps findings and flags truncation while keeping the true total", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      finding({ title: `f${i}` }),
    );
    const out = mapReviewToConcise(review(many), { maxFindings: 25 });
    expect(out.findings).toHaveLength(25);
    expect(out.findings_truncated).toBe(true);
    expect(out.total_findings).toBe(30);
  });

  it("truncates a long rationale and summary", () => {
    const long = "x".repeat(1000);
    const r = review([finding({ rationale: long })]);
    r.summary = long;
    const out = mapReviewToConcise(r);
    expect(out.findings[0]!.rationale.length).toBeLessThanOrEqual(240);
    expect(out.summary!.length).toBeLessThanOrEqual(500);
    expect(out.summary!.endsWith("…")).toBe(true);
  });
});
