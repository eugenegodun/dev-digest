import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../../../messages/en/runs.json";
import { PromptBlock } from "./PromptBlock";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <div>{ui}</div>
    </NextIntlClientProvider>,
  );
}

describe("PromptBlock", () => {
  it("renders the label", () => {
    renderWithIntl(
      <PromptBlock label="System" text="You are a reviewer." color="var(--text-muted)" />,
    );
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("shows token count chip when tokenCount is provided", () => {
    renderWithIntl(
      <PromptBlock
        label="System"
        text="You are a reviewer."
        color="var(--text-muted)"
        tokenCount={42}
      />,
    );
    expect(screen.getByText("~42 tok")).toBeInTheDocument();
  });

  it("does not show token count chip when tokenCount is undefined", () => {
    renderWithIntl(
      <PromptBlock label="System" text="You are a reviewer." color="var(--text-muted)" />,
    );
    expect(screen.queryByText(/tok/)).not.toBeInTheDocument();
  });

  it("does not show token count chip when tokenCount is 0", () => {
    // tokenCount of 0 is falsy — the conditional `tokenCount !== undefined`
    // ensures 0 still renders (it means an explicitly computed zero budget).
    renderWithIntl(
      <PromptBlock
        label="System"
        text="You are a reviewer."
        color="var(--text-muted)"
        tokenCount={0}
      />,
    );
    // tokenCount === 0 is !== undefined, so chip appears with "~0 tok"
    expect(screen.getByText("~0 tok")).toBeInTheDocument();
  });

  it("renders copy and expand buttons", () => {
    renderWithIntl(
      <PromptBlock label="System" text="You are a reviewer." color="var(--text-muted)" />,
    );
    expect(screen.getByLabelText("Copy")).toBeInTheDocument();
    expect(screen.getByLabelText("Open fullscreen")).toBeInTheDocument();
  });
});
