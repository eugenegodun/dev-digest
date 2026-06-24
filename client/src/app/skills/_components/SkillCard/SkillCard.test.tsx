import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Skill } from "@devdigest/shared";

// Mock delete hook — no network or QueryClient needed
vi.mock("../../../../lib/hooks/skills", () => ({
  useDeleteSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "ts-strictness",
  description: "Enforce strict TypeScript checks.",
  type: "rubric",
  source: "manual",
  body: "## TypeScript Strictness\n\nEnsure strict mode is enabled.",
  enabled: true,
  version: 1,
  body_tokens: 42,
  evidence_files: null,
};

describe("SkillCard (smoke)", () => {
  it("renders the skill name", () => {
    render(<SkillCard skill={SKILL} />);
    expect(screen.getByText("ts-strictness")).toBeInTheDocument();
  });

  it("renders the type badge", () => {
    render(<SkillCard skill={SKILL} />);
    expect(screen.getByText("rubric")).toBeInTheDocument();
  });

  it("renders a Toggle (role=switch) when onToggle is provided", () => {
    render(<SkillCard skill={SKILL} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("falls back to 'No description' when description is empty", () => {
    render(<SkillCard skill={{ ...SKILL, description: "" }} />);
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  it("shows token count chip", () => {
    render(<SkillCard skill={SKILL} />);
    expect(screen.getByText("~42 tok")).toBeInTheDocument();
  });
});
