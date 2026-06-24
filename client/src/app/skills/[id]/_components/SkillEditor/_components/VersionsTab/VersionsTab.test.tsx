import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import type { SkillVersionRow } from "@/lib/hooks/skills";

const mockMutate = vi.fn();
const mockRefetch = vi.fn();

// Use the alias path so vitest resolves it to the same module
vi.mock("@/lib/hooks/skills", () => ({
  useSkillVersions: vi.fn(),
  useRestoreSkillVersion: () => ({ mutate: mockMutate, isPending: false }),
}));

import { useSkillVersions } from "@/lib/hooks/skills";
import { VersionsTab } from "./VersionsTab";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SKILL: Skill = {
  id: "sk1",
  name: "ts-strictness",
  description: "Enforce strict TypeScript checks.",
  type: "rubric",
  source: "manual",
  body: "## Current body\n\nNew line.",
  enabled: true,
  version: 3,
  body_tokens: 120,
  evidence_files: null,
};

const VERSIONS: SkillVersionRow[] = [
  {
    skill_id: "sk1",
    version: 1,
    body: "## Version 1 body",
    note: "Initial version",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    skill_id: "sk1",
    version: 2,
    body: "## Version 2 body\n\nNew line.",
    note: null,
    created_at: "2024-02-01T00:00:00Z",
  },
  {
    skill_id: "sk1",
    version: 3,
    body: "## Current body\n\nNew line.",
    note: "Final version",
    created_at: "2024-03-01T00:00:00Z",
  },
];

// Minimal query-result shape — only the fields actually consumed by the component
function queryResult<T>(overrides: { data: T; isLoading: boolean; isError: boolean }) {
  return { ...overrides, refetch: mockRefetch } as unknown as ReturnType<typeof useSkillVersions>;
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("VersionsTab", () => {
  it("renders version list with correct labels", () => {
    vi.mocked(useSkillVersions).mockReturnValue(
      queryResult({ data: VERSIONS, isLoading: false, isError: false }),
    );

    wrap(<VersionsTab skill={SKILL} />);

    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("Initial version")).toBeInTheDocument();
    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("Final version")).toBeInTheDocument();
  });

  it("shows 'Current' badge on the highest version", () => {
    vi.mocked(useSkillVersions).mockReturnValue(
      queryResult({ data: VERSIONS, isLoading: false, isError: false }),
    );

    wrap(<VersionsTab skill={SKILL} />);

    expect(screen.getByText("Current")).toBeInTheDocument();
    // Only one "Current" badge
    expect(screen.getAllByText("Current")).toHaveLength(1);
  });

  it("shows restore button for non-current versions only", () => {
    vi.mocked(useSkillVersions).mockReturnValue(
      queryResult({ data: VERSIONS, isLoading: false, isError: false }),
    );

    wrap(<VersionsTab skill={SKILL} />);

    const restoreButtons = screen.getAllByText("Restore");
    // v1 and v2 get Restore; v3 (current) does not
    expect(restoreButtons).toHaveLength(2);
  });

  it("calls useRestoreSkillVersion mutate when restore button is clicked and confirmed", () => {
    vi.mocked(useSkillVersions).mockReturnValue(
      queryResult({ data: VERSIONS, isLoading: false, isError: false }),
    );

    wrap(<VersionsTab skill={SKILL} />);

    // Click the first "Restore" button (v2, since versions are sorted newest-first)
    const restoreButtons = screen.getAllByText("Restore");
    fireEvent.click(restoreButtons[0]!);

    // Confirm dialog should appear
    expect(screen.getByText(/Restore v/)).toBeInTheDocument();

    // Click the confirm button in the modal (use last Restore button found)
    const buttons = screen.getAllByRole("button", { name: /Restore/ });
    fireEvent.click(buttons[buttons.length - 1]!);

    expect(mockMutate).toHaveBeenCalledWith(
      { id: "sk1", version: 2 },
      expect.any(Object),
    );
  });

  it("shows version count in header", () => {
    vi.mocked(useSkillVersions).mockReturnValue(
      queryResult({ data: VERSIONS, isLoading: false, isError: false }),
    );

    wrap(<VersionsTab skill={SKILL} />);

    expect(screen.getByText(/3 versions/)).toBeInTheDocument();
  });

  it("shows loading skeletons while loading", () => {
    vi.mocked(useSkillVersions).mockReturnValue(
      queryResult({ data: undefined as unknown as SkillVersionRow[], isLoading: true, isError: false }),
    );

    wrap(<VersionsTab skill={SKILL} />);

    // No version content while loading
    expect(screen.queryByText("v1")).not.toBeInTheDocument();
  });

  it("shows error state when fetch fails", () => {
    vi.mocked(useSkillVersions).mockReturnValue(
      queryResult({ data: undefined as unknown as SkillVersionRow[], isLoading: false, isError: true }),
    );

    wrap(<VersionsTab skill={SKILL} />);

    expect(screen.getByText(/Failed to load versions/)).toBeInTheDocument();
  });
});
