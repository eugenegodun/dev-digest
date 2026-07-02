/**
 * DiffTab — RTL + Vitest flow tests (hardening).
 *
 * The DiffTab component renders a Smart/Original segmented toggle (always present,
 * no feature flag) plus either SmartDiffView (Smart order) or the flat DiffViewer
 * (Original order). All data hooks are mocked via vi.mock so no network or DB is
 * needed.
 *
 * Test 1: toggle renders unconditionally (no feature gate needed).
 * Test 2: default is Smart order — SmartDiffView container is visible.
 * Test 3: switching to Original order renders the flat DiffViewer.
 * Test 4: switching back to Smart from Original restores SmartDiffView.
 * Test 5: smart-diff query error → falls back gracefully to Original / DiffViewer.
 * Test 6: smart-diff loading state passes isLoading=true to SmartDiffView (skeleton).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { SmartDiff } from "@devdigest/shared";

// --- Mock hooks so DiffTab renders without a QueryClient or real network ---

// usePrSmartDiff + usePrBrief live in lib/hooks/brief
const mockSmartDiffState: {
  data: SmartDiff | undefined;
  isLoading: boolean;
  isError: boolean;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
};

vi.mock("@/lib/hooks/brief", () => ({
  usePrBrief: () => ({ data: undefined, isLoading: false }),
  usePrSmartDiff: () => mockSmartDiffState,
}));

vi.mock("@/lib/hooks/reviews", () => ({
  usePrComments: () => ({ data: [] }),
  useCreatePrComment: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePrReviews: () => ({ data: [] }),
}));

// DiffViewer is a complex component — stub it so our tests don't have to
// satisfy its render dependencies. We only need to detect its presence.
vi.mock("@/components/diff-viewer", () => ({
  DiffViewer: ({ files }: { files: unknown[] }) => (
    <div data-testid="diff-viewer" data-files={files.length} />
  ),
  DiffCommentApi: {},
}));

// SmartDiffView is also complex — stub it so tests are focused on DiffTab's
// routing logic, not SmartDiffView internals (those are covered separately).
vi.mock(
  "../SmartDiffView/SmartDiffView",
  () => ({
    SmartDiffView: ({
      isLoading,
      smartDiff,
    }: {
      isLoading?: boolean;
      smartDiff?: SmartDiff | null;
    }) => (
      <div
        data-testid="smart-diff-view"
        data-loading={String(!!isLoading)}
        data-has-data={String(!!smartDiff)}
      />
    ),
  }),
);

import { DiffTab } from "./DiffTab";

afterEach(() => {
  cleanup();
  // Reset smart-diff mock state to its default between tests.
  mockSmartDiffState.data = undefined;
  mockSmartDiffState.isLoading = false;
  mockSmartDiffState.isError = false;
});

// ---- render helper ----

function renderDiffTab({
  prId = "pr-1",
  filesCount = 3,
  files = [],
}: {
  prId?: string;
  filesCount?: number;
  files?: [];
} = {}) {
  return render(
    <DiffTab prId={prId} filesCount={filesCount} files={files} />,
  );
}

// ---- Tests ----

describe("DiffTab", () => {
  it("always renders the Smart/Original toggle — no feature flag required", () => {
    renderDiffTab();

    const group = screen.getByRole("group", { name: /diff order/i });
    expect(group).toBeInTheDocument();

    const smartBtn = screen.getByRole("button", { name: /smart order/i });
    const originalBtn = screen.getByRole("button", { name: /original order/i });

    expect(smartBtn).toBeInTheDocument();
    expect(originalBtn).toBeInTheDocument();
  });

  it("defaults to Smart order — SmartDiffView is shown, DiffViewer is not", () => {
    mockSmartDiffState.data = makeSmartDiff();
    mockSmartDiffState.isLoading = false;
    mockSmartDiffState.isError = false;

    renderDiffTab();

    // Smart button is pressed by default.
    const smartBtn = screen.getByRole("button", { name: /smart order/i });
    expect(smartBtn).toHaveAttribute("aria-pressed", "true");

    // SmartDiffView is mounted; flat DiffViewer is not.
    expect(screen.getByTestId("smart-diff-view")).toBeInTheDocument();
    expect(screen.queryByTestId("diff-viewer")).not.toBeInTheDocument();
  });

  it("clicking Original order renders the flat DiffViewer and hides SmartDiffView", () => {
    mockSmartDiffState.data = makeSmartDiff();
    renderDiffTab();

    // Click "Original order".
    fireEvent.click(screen.getByRole("button", { name: /original order/i }));

    // DiffViewer is now rendered; SmartDiffView is gone.
    expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("smart-diff-view")).not.toBeInTheDocument();

    // Original button is now pressed.
    expect(
      screen.getByRole("button", { name: /original order/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /smart order/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("switching back to Smart from Original restores SmartDiffView", () => {
    mockSmartDiffState.data = makeSmartDiff();
    renderDiffTab();

    // Switch to Original.
    fireEvent.click(screen.getByRole("button", { name: /original order/i }));
    expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();

    // Switch back to Smart.
    fireEvent.click(screen.getByRole("button", { name: /smart order/i }));

    // SmartDiffView is back; DiffViewer is gone.
    expect(screen.getByTestId("smart-diff-view")).toBeInTheDocument();
    expect(screen.queryByTestId("diff-viewer")).not.toBeInTheDocument();
  });

  it("smart-diff query error → falls back to Original/DiffViewer gracefully", () => {
    // Simulate a query error (e.g. network failure).
    mockSmartDiffState.data = undefined;
    mockSmartDiffState.isLoading = false;
    mockSmartDiffState.isError = true;

    renderDiffTab();

    // Even though the user hasn't clicked "Original", the error should cause
    // DiffTab to fall back to the flat DiffViewer (showSmartDiff = diffOrder === 'smart' && !smartDiffError).
    expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("smart-diff-view")).not.toBeInTheDocument();
  });

  it("while smart-diff is loading, SmartDiffView receives isLoading=true (shows skeleton)", () => {
    mockSmartDiffState.data = undefined;
    mockSmartDiffState.isLoading = true;
    mockSmartDiffState.isError = false;

    renderDiffTab();

    // SmartDiffView is mounted (not falling back to DiffViewer since no error).
    const sdv = screen.getByTestId("smart-diff-view");
    expect(sdv).toBeInTheDocument();
    expect(sdv).toHaveAttribute("data-loading", "true");
  });
});

// ---- Fixture helpers ----

function makeSmartDiff(): SmartDiff {
  return {
    groups: [
      {
        role: "core",
        files: [
          {
            path: "src/service.ts",
            additions: 10,
            deletions: 2,
            finding_lines: [],
            pseudocode_summary: null,
          },
        ],
      },
      { role: "wiring",      files: [] },
      { role: "boilerplate", files: [] },
    ],
    split_suggestion: {
      too_big: false,
      total_lines: 12,
      proposed_splits: [],
    },
  };
}
