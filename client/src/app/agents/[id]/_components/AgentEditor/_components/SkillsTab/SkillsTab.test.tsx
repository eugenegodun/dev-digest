import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { AgentSkillLink, Skill } from "@devdigest/shared";

// ---------------------------------------------------------------------------
// Mock hooks before the component import.
// ---------------------------------------------------------------------------

const mockSetSkillsMutate = vi.fn();

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useAgentSkills: (_agentId: string) => ({
    data: LINKS,
    isPending: false,
  }),
  useSkills: () => ({
    data: ALL_SKILLS,
    isPending: false,
  }),
  useSetAgentSkills: () => ({
    mutate: mockSetSkillsMutate,
    isPending: false,
  }),
}));

import { SkillsTab } from "./SkillsTab";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALL_SKILLS: Skill[] = [
  {
    id: "sk1",
    name: "Security Checks",
    description: "Detects common security issues.",
    type: "security",
    source: "manual",
    body: "# Security\nCheck for secrets.",
    enabled: true,
    version: 1,
    body_tokens: 10,
    evidence_files: [],
  },
  {
    id: "sk2",
    name: "Code Style",
    description: "Enforces style conventions.",
    type: "convention",
    source: "manual",
    body: "# Style\nFollow conventions.",
    enabled: true,
    version: 1,
    body_tokens: 8,
    evidence_files: [],
  },
  {
    id: "sk3",
    name: "Test Coverage",
    description: "Checks test coverage.",
    type: "rubric",
    source: "manual",
    body: "# Tests\nEnsure coverage.",
    enabled: true,
    version: 1,
    body_tokens: 6,
    evidence_files: [],
  },
];

// Agent has sk1 (order 0) and sk2 (order 1) attached; sk3 is available to add.
const LINKS: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "sk1", order: 0, enabled: true },
  { agent_id: "ag1", skill_id: "sk2", order: 1, enabled: true },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillsTab", () => {
  it("renders 'N of M enabled' header", () => {
    render(<SkillsTab agentId="ag1" />);
    expect(screen.getByText(/2 of 2 enabled/i)).toBeInTheDocument();
  });

  it("shows the names of attached skills", () => {
    render(<SkillsTab agentId="ag1" />);
    expect(screen.getByText("Security Checks")).toBeInTheDocument();
    expect(screen.getByText("Code Style")).toBeInTheDocument();
  });

  it("does not show unattached skills in the list", () => {
    render(<SkillsTab agentId="ag1" />);
    // "Test Coverage" is not attached, so it should not appear in the skill rows.
    expect(screen.queryByText("Test Coverage")).not.toBeInTheDocument();
  });

  it("calls setSkills without the skill when detach button is clicked", () => {
    render(<SkillsTab agentId="ag1" />);
    // Find detach button for "Security Checks" (sk1).
    const detachBtns = screen.getAllByRole("button", { name: /detach/i });
    // First detach button corresponds to first skill (order 0 = sk1).
    fireEvent.click(detachBtns[0]!);
    expect(mockSetSkillsMutate).toHaveBeenCalledWith(
      { agentId: "ag1", skillIds: ["sk2"] },
    );
  });

  it("calls setSkills with reversed order when 'Move down' is clicked", () => {
    render(<SkillsTab agentId="ag1" />);
    // First skill's move-down button.
    const moveDownBtns = screen.getAllByRole("button", { name: /move skill down/i });
    fireEvent.click(moveDownBtns[0]!);
    expect(mockSetSkillsMutate).toHaveBeenCalledWith(
      { agentId: "ag1", skillIds: ["sk2", "sk1"] },
    );
  });

  it("shows the 'Add skill' button when workspace skills are available", () => {
    render(<SkillsTab agentId="ag1" />);
    expect(screen.getByRole("button", { name: /add skill/i })).toBeInTheDocument();
  });

  it("shows available skills after clicking 'Add skill'", () => {
    render(<SkillsTab agentId="ag1" />);
    fireEvent.click(screen.getByRole("button", { name: /add skill/i }));
    expect(screen.getByText("Test Coverage")).toBeInTheDocument();
  });

  it("calls setSkills with the new skill appended when a skill is picked from the picker", () => {
    render(<SkillsTab agentId="ag1" />);
    fireEvent.click(screen.getByRole("button", { name: /add skill/i }));
    fireEvent.click(screen.getByText("Test Coverage"));
    expect(mockSetSkillsMutate).toHaveBeenCalledWith(
      { agentId: "ag1", skillIds: ["sk1", "sk2", "sk3"] },
    );
  });
});
