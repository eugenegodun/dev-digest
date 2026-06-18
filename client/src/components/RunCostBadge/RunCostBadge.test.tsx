/**
 * RunCostBadge — the contract that matters for the UI: a run with no usable
 * cost renders "—" (never "$0.00"), and the detailed view appends token usage.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RunCostBadge } from "./RunCostBadge";

afterEach(cleanup);

describe("RunCostBadge", () => {
  it("compact: shows the formatted cost", () => {
    render(<RunCostBadge costUsd={0.014} />);
    expect(screen.getByText("$0.014")).toBeInTheDocument();
  });

  it("compact: renders small costs with extra precision (not $0.00)", () => {
    render(<RunCostBadge costUsd={0.0013} />);
    expect(screen.getByText("$0.0013")).toBeInTheDocument();
  });

  it('renders "—" for null cost (no data), never "$0.00"', () => {
    render(<RunCostBadge costUsd={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("detailed: appends token usage", () => {
    render(<RunCostBadge variant="detailed" costUsd={0.014} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByText("$0.014 · 8k→1.3k")).toBeInTheDocument();
  });

  it("detailed: omits tokens when usage is absent", () => {
    render(<RunCostBadge variant="detailed" costUsd={0.014} tokensIn={null} tokensOut={null} />);
    expect(screen.getByText("$0.014")).toBeInTheDocument();
  });
});
