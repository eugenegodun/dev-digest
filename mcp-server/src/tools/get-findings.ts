import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ApiClient } from "../api/client.js";
import type { ReviewDto } from "../api/types.js";
import { textResult, toToolError, type ToolResult } from "../errors.js";
import { mapReviewToConcise } from "../shape/findings.js";

const DESCRIPTION =
  "Returns the verdict and findings for an ALREADY-COMPLETED review on a PR. " +
  "Read-only: it does NOT start a review and does NOT wait — if no review has " +
  "finished yet it returns an empty result with a hint. To START a new review, " +
  "use run_agent_on_pr. Provide run_id to target one specific run; otherwise the " +
  "latest completed review for the PR is returned.";

export const getFindingsInput = {
  pr_id: z
    .string()
    .uuid()
    .describe("The PR UUID whose review results to read (from list_pulls)."),
  run_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Optional: a specific run's UUID (from run_agent_on_pr). If omitted, returns the most recent completed review for the PR.",
    ),
};

/** Pick the target review: by run_id if given, else the newest 'review' kind. */
function selectReview(reviews: ReviewDto[], runId?: string): ReviewDto | undefined {
  const candidates = reviews.filter((r) => r.kind === "review");
  if (runId) return candidates.find((r) => r.run_id === runId);
  return [...candidates].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
}

export function createGetFindingsHandler(api: ApiClient) {
  return async (args: { pr_id: string; run_id?: string }): Promise<ToolResult> => {
    try {
      const reviews = await api.reviewsForPull(args.pr_id);
      const review = selectReview(reviews, args.run_id);
      if (!review) {
        return textResult({
          status: "no_review",
          hint: args.run_id
            ? "No completed review found for that run_id. It may still be running — try again shortly, or start one with run_agent_on_pr."
            : "No completed review found for this PR. Start one with run_agent_on_pr, or it may still be running.",
        });
      }
      return textResult({ status: "done", ...mapReviewToConcise(review) });
    } catch (err) {
      return toToolError(
        err,
        "Verify the pr_id is valid — list PRs with list_pulls.",
      );
    }
  };
}

export function registerGetFindings(server: McpServer, api: ApiClient): void {
  server.registerTool(
    "get_findings",
    {
      title: "Get findings for a completed review run",
      description: DESCRIPTION,
      inputSchema: getFindingsInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    createGetFindingsHandler(api),
  );
}
