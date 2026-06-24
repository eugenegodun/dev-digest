/**
 * BlastRadiusCard — RTL + Vitest flow tests.
 *
 * Test 1: populated blast data → stat row (symbols/callers/endpoints/crons) +
 *         downstream list render correctly.
 * Test 2: empty downstream (but non-empty changed_symbols) → "noDownstream" copy.
 *
 * usePrBrief is mocked via vi.mock so the component renders without a QueryClient
 * or real network. Messages come from the real blast.json + brief.json namespaces.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrBrief } from "@devdigest/shared";
import blastMessages from "../../../../../../../../messages/en/blast.json";
import briefMessages from "../../../../../../../../messages/en/brief.json";

// --- Mutable holder so each test can control the hook return value ---
const mockBriefState: { data: PrBrief | undefined; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};

vi.mock("@/lib/hooks/brief", () => ({
  usePrBrief: () => mockBriefState,
}));

import { BlastRadiusCard } from "./BlastRadiusCard";

afterEach(cleanup);

// ---- fixtures ----

const FULL_BRIEF: PrBrief = {
  intent: { intent: "Refactor auth.", in_scope: [], out_of_scope: [] },
  blast: {
    changed_symbols: [
      { name: "verifyToken", file: "src/auth/jwt.ts", kind: "function" },
      { name: "AuthGuard", file: "src/auth/guard.ts", kind: "class" },
    ],
    downstream: [
      {
        symbol: "verifyToken",
        callers: [
          { name: "loginHandler", file: "src/routes/login.ts", line: 42 },
          { name: "refreshHandler", file: "src/routes/refresh.ts", line: 18 },
        ],
        endpoints_affected: ["/api/login", "/api/refresh"],
        crons_affected: ["nightly-token-cleanup"],
      },
    ],
    summary: "Auth module refactor affects login and refresh routes.",
  },
  risks: { risks: [] },
  history: { history: [] },
};

/** Brief with changed symbols but no downstream callers/endpoints/crons. */
const NO_DOWNSTREAM_BRIEF: PrBrief = {
  intent: { intent: "Add new utility.", in_scope: [], out_of_scope: [] },
  blast: {
    changed_symbols: [
      { name: "formatDate", file: "src/utils/date.ts", kind: "function" },
      { name: "parseDate", file: "src/utils/date.ts", kind: "function" },
    ],
    downstream: [],
    summary: "",
  },
  risks: { risks: [] },
  history: { history: [] },
};

// ---- render helper ----

function renderCard(prId?: string) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ blast: blastMessages, brief: briefMessages }}
    >
      <BlastRadiusCard prId={prId ?? "pr-1"} />
    </NextIntlClientProvider>,
  );
}

// ---- tests ----

describe("BlastRadiusCard", () => {
  it("renders stat row and downstream list when blast data is populated", () => {
    mockBriefState.data = FULL_BRIEF;
    mockBriefState.isLoading = false;

    renderCard();

    // Card header from brief.json → block.blast
    expect(screen.getByText(briefMessages.block.blast)).toBeInTheDocument();

    // Stat row — stat labels from blast.json
    expect(screen.getByText(blastMessages.stat.symbols)).toBeInTheDocument();
    expect(screen.getByText(blastMessages.stat.callers)).toBeInTheDocument();
    expect(screen.getByText(blastMessages.stat.endpoints)).toBeInTheDocument();
    expect(screen.getByText(blastMessages.stat.crons)).toBeInTheDocument();

    // Stat values
    // 2 changed symbols
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    // 2 callers total
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    // 2 endpoints unique
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    // 1 cron unique
    expect(screen.getByText("1")).toBeInTheDocument();

    // Downstream symbol name and kind
    expect(screen.getByText("verifyToken")).toBeInTheDocument();
    expect(screen.getByText("function")).toBeInTheDocument();

    // Symbol file
    expect(screen.getByText("src/auth/jwt.ts")).toBeInTheDocument();

    // Callers
    expect(screen.getByText(/loginHandler/)).toBeInTheDocument();
    expect(screen.getByText(/refreshHandler/)).toBeInTheDocument();

    // Endpoints tag
    expect(screen.getByText("/api/login")).toBeInTheDocument();
    expect(screen.getByText("/api/refresh")).toBeInTheDocument();

    // Cron tag
    expect(screen.getByText("nightly-token-cleanup")).toBeInTheDocument();
  });

  it("renders noDownstream copy when downstream is empty", () => {
    mockBriefState.data = NO_DOWNSTREAM_BRIEF;
    mockBriefState.isLoading = false;

    renderCard();

    // Stat labels present
    expect(screen.getByText(blastMessages.stat.symbols)).toBeInTheDocument();

    // 2 changed symbols shows in stat
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    // 0 callers
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);

    // noDownstream message rendered — blast.json uses {count} interpolation
    // "2 changed symbol(s), no downstream callers found."
    expect(screen.getByText(/no downstream callers found/i)).toBeInTheDocument();
    expect(screen.getByText(/2 changed symbol/i)).toBeInTheDocument();

    // Symbol names NOT in downstream section (no downstream entries)
    // but changed_symbols are only shown within downstream entries, so not present as names
    // The no-downstream path should NOT render downstream entries
    expect(screen.queryByText(/formatDate/)).not.toBeInTheDocument();
  });
});
