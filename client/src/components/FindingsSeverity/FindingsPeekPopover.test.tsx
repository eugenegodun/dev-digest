/**
 * FindingsPeekPopover — the counter as a click trigger that opens an anchored
 * popover listing the findings, and closes on an outside click. With no
 * findings it degrades to a muted "—" (no trigger).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { FindingsPeekPopover } from ".";
import type { Finding } from "@/lib/types";

afterEach(cleanup);

const finding = (o: Partial<Finding> = {}): Finding => ({
  id: "f1",
  severity: "CRITICAL",
  category: "security",
  title: "Hardcoded secret",
  file: "src/config.ts",
  start_line: 12,
  end_line: 12,
  rationale: "A live secret key is committed.",
  suggestion: null,
  confidence: 0.98,
  ...o,
});

describe("FindingsPeekPopover", () => {
  it('renders a muted "—" and no trigger when there are no findings', () => {
    render(
      <FindingsPeekPopover counts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} findings={[]} title="0 findings" />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens on click and lists the findings (title + file:line)", () => {
    render(
      <FindingsPeekPopover counts={{ CRITICAL: 1, WARNING: 0, SUGGESTION: 0 }} findings={[finding()]} title="1 finding" />,
    );
    expect(screen.queryByText("Hardcoded secret")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("1 finding")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
  });

  it("closes on outside click and notifies via onOpenChange", () => {
    const onOpenChange = vi.fn();
    render(
      <FindingsPeekPopover
        counts={{ CRITICAL: 1, WARNING: 0, SUGGESTION: 0 }}
        findings={[finding()]}
        title="1 finding"
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText("Hardcoded secret")).not.toBeInTheDocument();
  });
});
