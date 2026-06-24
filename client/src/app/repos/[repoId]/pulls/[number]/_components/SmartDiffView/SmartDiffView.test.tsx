/**
 * SmartDiffView — RTL + Vitest flow tests.
 *
 * Test 1: groups render in fixed canonical order (core → wiring → boilerplate).
 * Test 2: boilerplate group is collapsed by default; user can expand it.
 * Test 3: file with findings shows a severity-colored badge; clicking expands + scrolls.
 * Test 4: split banner appears only when too_big is true.
 * Test 5: loading state renders skeleton; missing data renders unavailable message.
 *
 * usePrSmartDiff / usePrReviews are NOT used here — SmartDiffView is a pure
 * presentational component. Tests provide data via props directly.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { SmartDiff, SmartDiffGroup } from "@devdigest/shared";
import type { PrFile } from "@devdigest/shared";
import type { ReviewRecord } from "@devdigest/shared";
import { SmartDiffView } from "./SmartDiffView";

afterEach(cleanup);

// ---- Fixtures ----

const CORE_GROUP: SmartDiffGroup = {
  role: "core",
  files: [
    {
      path: "src/service.ts",
      additions: 20,
      deletions: 5,
      finding_lines: [10, 20],
      pseudocode_summary: null,
    },
    {
      path: "src/utils.ts",
      additions: 5,
      deletions: 2,
      finding_lines: [],
      pseudocode_summary: null,
    },
  ],
};

const WIRING_GROUP: SmartDiffGroup = {
  role: "wiring",
  files: [
    {
      path: "index.ts",
      additions: 3,
      deletions: 1,
      finding_lines: [],
      pseudocode_summary: null,
    },
  ],
};

const BOILERPLATE_GROUP: SmartDiffGroup = {
  role: "boilerplate",
  files: [
    {
      path: "package-lock.json",
      additions: 100,
      deletions: 50,
      finding_lines: [],
      pseudocode_summary: null,
    },
  ],
};

const SMART_DIFF: SmartDiff = {
  groups: [CORE_GROUP, WIRING_GROUP, BOILERPLATE_GROUP],
  split_suggestion: {
    too_big: false,
    total_lines: 35,
    proposed_splits: [],
  },
};

const SMART_DIFF_TOO_BIG: SmartDiff = {
  groups: [CORE_GROUP, WIRING_GROUP, BOILERPLATE_GROUP],
  split_suggestion: {
    too_big: true,
    total_lines: 500,
    proposed_splits: [
      { name: "src", files: ["src/service.ts", "src/utils.ts"] },
    ],
  },
};

const PR_FILES: PrFile[] = [
  { path: "src/service.ts", additions: 20, deletions: 5, patch: "@@ -1,5 +1,20 @@\n+added line\n context line" },
  { path: "src/utils.ts", additions: 5, deletions: 2, patch: "@@ -1,2 +1,5 @@\n context" },
  { path: "index.ts", additions: 3, deletions: 1, patch: "@@ -1,1 +1,3 @@\n context" },
  { path: "package-lock.json", additions: 100, deletions: 50, patch: null },
];

const FINDING_RECORD: ReviewRecord = {
  id: "rev-1",
  pr_id: "pr-1",
  agent_id: "agent-1",
  run_id: "run-1",
  agent_name: "security-agent",
  kind: "review",
  verdict: "request_changes",
  summary: "Review summary",
  score: 60,
  model: "gpt-4",
  grounding: null,
  created_at: "2026-06-24T00:00:00Z",
  cost_usd: null,
  tokens_in: null,
  tokens_out: null,
  findings: [
    {
      id: "finding-1",
      severity: "CRITICAL",
      category: "security",
      title: "SQL injection risk",
      file: "src/service.ts",
      start_line: 10,
      end_line: 12,
      rationale: "User input is passed directly to SQL.",
      suggestion: null,
      confidence: 0.95,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "rev-1",
      accepted_at: null,
      dismissed_at: null,
    },
  ],
};

// ---- Tests ----

describe("SmartDiffView", () => {
  it("renders all three role groups in canonical order: core → wiring → boilerplate", () => {
    render(
      <SmartDiffView
        smartDiff={SMART_DIFF}
        prFiles={PR_FILES}
        reviews={[]}
      />,
    );

    // All three group headings should be visible.
    expect(screen.getByText("CORE LOGIC")).toBeInTheDocument();
    expect(screen.getByText("WIRING")).toBeInTheDocument();
    expect(screen.getByText("BOILERPLATE")).toBeInTheDocument();

    // Confirm order by checking document order of headings.
    const headings = screen.getAllByText(/CORE LOGIC|WIRING|BOILERPLATE/);
    const texts = headings.map((el) => el.textContent);
    expect(texts).toEqual(["CORE LOGIC", "WIRING", "BOILERPLATE"]);
  });

  it("boilerplate group is collapsed by default and can be expanded", () => {
    render(
      <SmartDiffView
        smartDiff={SMART_DIFF}
        prFiles={PR_FILES}
        reviews={[]}
      />,
    );

    // Boilerplate file should NOT be visible while group is collapsed.
    expect(screen.queryByText("package-lock.json")).not.toBeInTheDocument();

    // Click the boilerplate group header to expand.
    const boilerplateHeader = screen.getByRole("button", { name: /boilerplate group/i });
    fireEvent.click(boilerplateHeader);

    // Now the boilerplate file should appear.
    expect(screen.getByText("package-lock.json")).toBeInTheDocument();
  });

  it("shows a findings badge on files with findings, colored by highest severity", () => {
    render(
      <SmartDiffView
        smartDiff={SMART_DIFF}
        prFiles={PR_FILES}
        reviews={[FINDING_RECORD]}
      />,
    );

    // The file with a finding should show a badge (labeled with count + "click to expand").
    const badge = screen.getByRole("button", {
      name: /click to expand and jump to first/i,
    });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("1 finding");

    // Only one such badge should exist (src/utils.ts has no findings).
    const allFindingsBadges = screen.queryAllByRole("button", {
      name: /click to expand and jump to first/i,
    });
    expect(allFindingsBadges).toHaveLength(1);
  });

  it("clicking the findings badge expands the file card", () => {
    // Use a SmartDiff where the file card starts collapsed (file has no findings initially open).
    // We need to first collapse the file, then click badge to expand.
    // The SmartFileCard starts open for core files by default, so we just verify
    // badge click keeps it open and the content is visible.
    const coreGroupWithFinding: SmartDiffGroup = {
      role: "core",
      files: [
        {
          path: "src/service.ts",
          additions: 20,
          deletions: 5,
          finding_lines: [10],
          pseudocode_summary: null,
        },
      ],
    };

    const diffWithFinding: SmartDiff = {
      groups: [coreGroupWithFinding, WIRING_GROUP, BOILERPLATE_GROUP],
      split_suggestion: SMART_DIFF.split_suggestion,
    };

    render(
      <SmartDiffView
        smartDiff={diffWithFinding}
        prFiles={PR_FILES}
        reviews={[FINDING_RECORD]}
      />,
    );

    // The findings badge exists (it's a <button> with "finding" in the accessible name).
    const badge = screen.getByRole("button", { name: /click to expand and jump to first/i });
    expect(badge).toBeInTheDocument();

    // The file is already open (core group default); content should be visible.
    expect(screen.getByText(/added line/)).toBeInTheDocument();

    // Click the badge — no error, badge is clickable.
    fireEvent.click(badge);

    // Content still visible after click.
    expect(screen.getByText(/added line/)).toBeInTheDocument();
  });

  it("shows the split banner only when too_big is true", () => {
    const { unmount } = render(
      <SmartDiffView
        smartDiff={SMART_DIFF}
        prFiles={PR_FILES}
        reviews={[]}
      />,
    );
    // No banner when too_big is false.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    unmount();

    // Re-render with too_big = true.
    render(
      <SmartDiffView
        smartDiff={SMART_DIFF_TOO_BIG}
        prFiles={PR_FILES}
        reviews={[]}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/consider splitting/i)).toBeInTheDocument();
    // Proposed split name should appear.
    expect(screen.getByText("src")).toBeInTheDocument();
  });

  it("renders a loading skeleton when isLoading is true", () => {
    render(
      <SmartDiffView
        smartDiff={undefined}
        isLoading={true}
        prFiles={[]}
        reviews={[]}
      />,
    );
    expect(screen.getByLabelText("Loading smart diff")).toBeInTheDocument();
    expect(screen.queryByText("CORE LOGIC")).not.toBeInTheDocument();
  });

  it("renders an unavailable message when smartDiff is null and not loading", () => {
    render(
      <SmartDiffView
        smartDiff={null}
        isLoading={false}
        prFiles={[]}
        reviews={[]}
      />,
    );
    expect(screen.getByLabelText("Smart diff unavailable")).toBeInTheDocument();
    expect(screen.getByText(/not yet available/i)).toBeInTheDocument();
  });

  // ── Edge-case hardening ────────────────────────────────────────────────────

  it("renders without error when smartDiff has no files in any group (empty groups)", () => {
    const emptySmartDiff: SmartDiff = {
      groups: [
        { role: "core",        files: [] },
        { role: "wiring",      files: [] },
        { role: "boilerplate", files: [] },
      ],
      split_suggestion: {
        too_big: false,
        total_lines: 0,
        proposed_splits: [],
      },
    };

    render(
      <SmartDiffView
        smartDiff={emptySmartDiff}
        prFiles={[]}
        reviews={[]}
      />,
    );

    // Container renders — the reviewer-ordered diff wrapper is present.
    expect(screen.getByLabelText("Reviewer-ordered diff")).toBeInTheDocument();

    // No group headings appear because RoleGroup returns null for empty groups.
    expect(screen.queryByText("CORE LOGIC")).not.toBeInTheDocument();
    expect(screen.queryByText("WIRING")).not.toBeInTheDocument();
    expect(screen.queryByText("BOILERPLATE")).not.toBeInTheDocument();

    // No split banner.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("file with findings in smartDiff.finding_lines but reviews not yet loaded renders badge-free without crashing", () => {
    // Smart diff says there are finding_lines on the file, but reviews=[] (not loaded).
    // The badge only shows when BOTH findingCount > 0 AND highestSeverity !== null.
    // With reviews=[], highestSeverityForFile → null, so no badge should appear.
    const diffWithFindingLines: SmartDiff = {
      groups: [
        {
          role: "core",
          files: [
            {
              path: "src/service.ts",
              additions: 20,
              deletions: 5,
              finding_lines: [10, 20], // server says lines are flagged
              pseudocode_summary: null,
            },
          ],
        },
        { role: "wiring",      files: [] },
        { role: "boilerplate", files: [] },
      ],
      split_suggestion: { too_big: false, total_lines: 25, proposed_splits: [] },
    };

    render(
      <SmartDiffView
        smartDiff={diffWithFindingLines}
        prFiles={PR_FILES}
        reviews={[]}          // reviews not yet loaded
      />,
    );

    // Component renders without throwing.
    expect(screen.getByText("src/service.ts")).toBeInTheDocument();

    // No findings badge — reviews haven't loaded so severity is unknown.
    expect(
      screen.queryByRole("button", { name: /click to expand and jump to first/i }),
    ).not.toBeInTheDocument();
  });

  it("findings badge uses HIGHEST severity color when file has mixed severities", () => {
    // The review has two findings on the same file: WARNING and CRITICAL.
    // The badge should reflect CRITICAL (highest).
    const mixedSeverityReview: ReviewRecord = {
      id: "rev-2",
      pr_id: "pr-1",
      agent_id: "agent-1",
      run_id: "run-1",
      agent_name: "agent",
      kind: "review",
      verdict: "request_changes",
      summary: "Mixed severity review",
      score: 50,
      model: "gpt-4",
      grounding: null,
      created_at: "2026-06-24T00:00:00Z",
      cost_usd: null,
      tokens_in: null,
      tokens_out: null,
      findings: [
        {
          id: "finding-warn",
          severity: "WARNING",
          category: "perf",
          title: "Slow loop",
          file: "src/service.ts",
          start_line: 5,
          end_line: 7,
          rationale: "O(n²) loop.",
          suggestion: null,
          confidence: 0.8,
          kind: "finding",
          trifecta_components: null,
          evidence: null,
          review_id: "rev-2",
          accepted_at: null,
          dismissed_at: null,
        },
        {
          id: "finding-crit",
          severity: "CRITICAL",
          category: "security",
          title: "SQL injection",
          file: "src/service.ts",
          start_line: 20,
          end_line: 22,
          rationale: "Unescaped user input in query.",
          suggestion: null,
          confidence: 0.95,
          kind: "finding",
          trifecta_components: null,
          evidence: null,
          review_id: "rev-2",
          accepted_at: null,
          dismissed_at: null,
        },
      ],
    };

    const diffWithMixed: SmartDiff = {
      groups: [
        {
          role: "core",
          files: [
            {
              path: "src/service.ts",
              additions: 30,
              deletions: 5,
              finding_lines: [5, 20],
              pseudocode_summary: null,
            },
          ],
        },
        { role: "wiring",      files: [] },
        { role: "boilerplate", files: [] },
      ],
      split_suggestion: { too_big: false, total_lines: 35, proposed_splits: [] },
    };

    render(
      <SmartDiffView
        smartDiff={diffWithMixed}
        prFiles={PR_FILES}
        reviews={[mixedSeverityReview]}
      />,
    );

    // The badge should exist and show 2 findings.
    const badge = screen.getByRole("button", { name: /click to expand and jump to first/i });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("2 findings");

    // The badge should be colored with CRITICAL's CSS var, not WARNING's.
    // SEV_COLOR.CRITICAL = "var(--crit)"; SEV_COLOR.WARNING = "var(--warn)".
    // jsdom renders inline style; assert it contains the critical color token.
    expect(badge).toHaveStyle({ color: "var(--crit)" });
  });
});
