/**
 * FindingsBadgeGroup — the per-severity counter: one badge per non-zero
 * severity (with its count), nothing at all when there are no findings (the
 * caller renders the muted "—"). Plus the pure count helpers.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FindingsBadgeGroup, totalFindings, countsFromFindings } from ".";

afterEach(cleanup);

describe("FindingsBadgeGroup", () => {
  it("renders a badge per non-zero severity with its count", () => {
    render(<FindingsBadgeGroup counts={{ CRITICAL: 2, WARNING: 3, SUGGESTION: 1 }} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("hides a severity whose count is 0", () => {
    render(<FindingsBadgeGroup counts={{ CRITICAL: 0, WARNING: 4, SUGGESTION: 0 }} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders nothing when all counts are 0", () => {
    const { container } = render(
      <FindingsBadgeGroup counts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for null counts (never reviewed)", () => {
    const { container } = render(<FindingsBadgeGroup counts={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("count helpers", () => {
  it("totalFindings sums the buckets (0 for null)", () => {
    expect(totalFindings({ CRITICAL: 2, WARNING: 3, SUGGESTION: 1 })).toBe(6);
    expect(totalFindings(null)).toBe(0);
  });

  it("countsFromFindings tallies by severity, ignoring unknown", () => {
    expect(
      countsFromFindings([
        { severity: "CRITICAL" },
        { severity: "WARNING" },
        { severity: "WARNING" },
        { severity: "SUGGESTION" },
        { severity: "INFO" },
      ]),
    ).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 1 });
  });
});
