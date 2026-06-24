/**
 * IntentCard — RTL + Vitest flow tests.
 *
 * Test 1: brief loads → intent statement + in/out-of-scope items render.
 * Test 2: unavailable/empty state renders the "unavailable" copy.
 *
 * usePrBrief is mocked via vi.mock so the component renders without a
 * QueryClient or real network. The messages fixture comes from the real
 * brief.json namespace (the component uses useTranslations("brief")).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrBrief } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/brief.json";

// --- Mutable holder so each test can set the hook return value ---
const mockBriefState: { data: PrBrief | undefined; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};

vi.mock("@/lib/hooks/brief", () => ({
  usePrBrief: () => mockBriefState,
}));

import { IntentCard } from "./IntentCard";

afterEach(cleanup);

const FULL_BRIEF: PrBrief = {
  intent: {
    intent: "Refactor the authentication module to use JWT.",
    in_scope: ["JWT token issuance", "Session validation middleware"],
    out_of_scope: ["OAuth flow", "Password reset"],
  },
  blast: { changed_symbols: [], downstream: [], summary: "" },
  risks: { risks: [] },
  history: { history: [] },
};

const EMPTY_BRIEF: PrBrief = {
  intent: { intent: "", in_scope: [], out_of_scope: [] },
  blast: { changed_symbols: [], downstream: [], summary: "" },
  risks: { risks: [] },
  history: { history: [] },
};

function renderCard(prId?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ brief: messages }}>
      <IntentCard prId={prId ?? "pr-1"} />
    </NextIntlClientProvider>,
  );
}

describe("IntentCard", () => {
  it("renders intent statement and in/out-of-scope lists when brief loads", () => {
    mockBriefState.data = FULL_BRIEF;
    mockBriefState.isLoading = false;

    renderCard();

    // Intent statement
    expect(
      screen.getByText("Refactor the authentication module to use JWT."),
    ).toBeInTheDocument();

    // In-scope items
    expect(screen.getByText("JWT token issuance")).toBeInTheDocument();
    expect(screen.getByText("Session validation middleware")).toBeInTheDocument();

    // Out-of-scope items
    expect(screen.getByText("OAuth flow")).toBeInTheDocument();
    expect(screen.getByText("Password reset")).toBeInTheDocument();

    // Section headings
    expect(screen.getByText("IN SCOPE")).toBeInTheDocument();
    expect(screen.getByText("OUT OF SCOPE")).toBeInTheDocument();
  });

  it("renders the unavailable copy when intent is empty", () => {
    mockBriefState.data = EMPTY_BRIEF;
    mockBriefState.isLoading = false;

    renderCard();

    expect(screen.getByText(messages.unavailable)).toBeInTheDocument();
    expect(screen.getByText(messages.unavailableHint)).toBeInTheDocument();

    // No intent content should be visible
    expect(
      screen.queryByText("Refactor the authentication module to use JWT."),
    ).not.toBeInTheDocument();
  });

  it("renders the unavailable copy when brief data is missing", () => {
    mockBriefState.data = undefined;
    mockBriefState.isLoading = false;

    renderCard();

    expect(screen.getByText(messages.unavailable)).toBeInTheDocument();
  });
});
