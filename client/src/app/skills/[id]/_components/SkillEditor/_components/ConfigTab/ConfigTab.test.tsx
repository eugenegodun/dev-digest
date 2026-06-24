import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/lib/toast";
import type { Skill } from "@devdigest/shared";

// Mock hooks — no network needed
vi.mock("../../../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, data: undefined }),
}));

import { ConfigTab } from "./ConfigTab";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "ts-strictness",
  description: "Enforce strict TypeScript checks.",
  type: "rubric",
  source: "manual",
  body: "## Original body",
  enabled: true,
  version: 2,
  body_tokens: 120,
  evidence_files: null,
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe("ConfigTab", () => {
  it("does not show Unsaved indicator when body is unchanged", () => {
    wrap(<ConfigTab skill={SKILL} />);
    expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
  });

  it("shows Unsaved indicator when body textarea is edited", () => {
    wrap(<ConfigTab skill={SKILL} />);
    const textarea = document.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "Changed body text" } });
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });

  it("shows client token estimate (~N tok) when body is edited", () => {
    wrap(<ConfigTab skill={SKILL} />);
    const textarea = document.querySelector("textarea")!;
    // 4 chars → ceil(4/4) = 1 tok
    fireEvent.change(textarea, { target: { value: "AAAA" } });
    expect(screen.getByText("~1 tok")).toBeInTheDocument();
  });

  it("shows saved token count (no ~ prefix) when body matches the skill", () => {
    wrap(<ConfigTab skill={SKILL} />);
    // body is unchanged → show skill.body_tokens without ~
    expect(screen.getByText("120 tok")).toBeInTheDocument();
  });
});
