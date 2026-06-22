import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SkillStats } from "@devdigest/shared";

const mockRefetch = vi.fn();

// Use the alias path so vitest resolves it to the same module
vi.mock("@/lib/hooks/skills", () => ({
  useSkillStats: vi.fn(),
}));

import { useSkillStats } from "@/lib/hooks/skills";
import { StatsTab } from "./StatsTab";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const STATS_WITH_AGENTS: SkillStats = {
  used_by_count: 2,
  agents: [
    { id: "ag1", name: "TypeScript Reviewer", enabled: true },
    { id: "ag2", name: "Security Reviewer", enabled: false },
  ],
};

const STATS_EMPTY: SkillStats = {
  used_by_count: 0,
  agents: [],
};

function queryResult<T>(overrides: { data: T; isLoading: boolean; isError: boolean }) {
  return { ...overrides, refetch: mockRefetch } as unknown as ReturnType<typeof useSkillStats>;
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("StatsTab", () => {
  it("shows 'Not yet tracked' for pull frequency, accept rate, and findings by category", () => {
    vi.mocked(useSkillStats).mockReturnValue(
      queryResult({ data: STATS_WITH_AGENTS, isLoading: false, isError: false }),
    );

    wrap(<StatsTab skillId="sk1" />);

    const notTracked = screen.getAllByText("Not yet tracked");
    expect(notTracked.length).toBeGreaterThanOrEqual(3);

    expect(screen.getByText("Pull frequency")).toBeInTheDocument();
    expect(screen.getByText("Accept rate")).toBeInTheDocument();
    expect(screen.getByText("Findings by category")).toBeInTheDocument();
  });

  it("shows agent names with their enabled/disabled status", () => {
    vi.mocked(useSkillStats).mockReturnValue(
      queryResult({ data: STATS_WITH_AGENTS, isLoading: false, isError: false }),
    );

    wrap(<StatsTab skillId="sk1" />);

    expect(screen.getByText("TypeScript Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("enabled")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();
  });

  it("shows the used_by_count number and 'agents' label", () => {
    vi.mocked(useSkillStats).mockReturnValue(
      queryResult({ data: STATS_WITH_AGENTS, isLoading: false, isError: false }),
    );

    wrap(<StatsTab skillId="sk1" />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("agents")).toBeInTheDocument();
  });

  it("shows 0 used_by_count when no agents", () => {
    vi.mocked(useSkillStats).mockReturnValue(
      queryResult({ data: STATS_EMPTY, isLoading: false, isError: false }),
    );

    wrap(<StatsTab skillId="sk1" />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows loading skeletons while loading", () => {
    vi.mocked(useSkillStats).mockReturnValue(
      queryResult({ data: undefined as unknown as SkillStats, isLoading: true, isError: false }),
    );

    wrap(<StatsTab skillId="sk1" />);

    expect(screen.queryByText("Pull frequency")).not.toBeInTheDocument();
  });

  it("shows error state when fetch fails", () => {
    vi.mocked(useSkillStats).mockReturnValue(
      queryResult({ data: undefined as unknown as SkillStats, isLoading: false, isError: true }),
    );

    wrap(<StatsTab skillId="sk1" />);

    expect(screen.getByText(/Failed to load stats/)).toBeInTheDocument();
  });

  it("agent links point to /agents/{id}?tab=config", () => {
    vi.mocked(useSkillStats).mockReturnValue(
      queryResult({ data: STATS_WITH_AGENTS, isLoading: false, isError: false }),
    );

    wrap(<StatsTab skillId="sk1" />);

    const agentLink = screen.getByText("TypeScript Reviewer").closest("a");
    expect(agentLink).toHaveAttribute("href", "/agents/ag1?tab=config");
  });
});
