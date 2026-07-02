import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ApiClient } from "../api/client.js";
import { streamRunEvents, type StreamRunEvents } from "../api/sse.js";
import type { Config } from "../config.js";
import { textResult, toToolError, type ToolResult } from "../errors.js";
import { mapReviewToConcise } from "../shape/findings.js";

const DESCRIPTION =
  "Runs ONE reviewer agent on ONE pull request and BLOCKS until the review " +
  "completes, then returns the verdict and findings. It performs all three steps " +
  "itself: starts the run, waits for completion, and fetches the results — you do " +
  "NOT need to poll or call get_findings afterward. Use this to START a new " +
  "review. To read an ALREADY-finished run's results without starting one, use " +
  "get_findings instead. If the review exceeds the timeout it returns " +
  "{status:'timeout', run_id, pr_id, hint} so you can fetch results later.";

export const runAgentInput = {
  pr_id: z
    .string()
    .uuid()
    .describe("The PR UUID from list_pulls. NOT the GitHub PR number."),
  agent_id: z
    .string()
    .uuid()
    .describe("The reviewer agent UUID to run. Get a valid id from list_agents."),
  timeout_ms: z
    .number()
    .int()
    .min(10_000)
    .max(600_000)
    .optional()
    .describe(
      "Max time to block waiting for the review. Defaults to the server config (~180000). If exceeded, returns the run_id and a hint to call get_findings later.",
    ),
};

type RunAgentArgs = { pr_id: string; agent_id: string; timeout_ms?: number };
type RunAgentCtx = { onProgress?: (msg: string) => void };

export interface RunAgentDeps {
  api: ApiClient;
  config: Config;
  /** Injectable for tests; defaults to the real SSE consumer. */
  streamRunEvents?: StreamRunEvents;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function pollUntilTerminal(
  api: ApiClient,
  prId: string,
  runId: string,
  signal: AbortSignal,
  intervalMs: number,
): Promise<void> {
  while (!signal.aborted) {
    const runs = await api.listRuns(prId);
    const row = runs.find((r) => r.run_id === runId);
    if (row?.status && row.status !== "running") return;
    await sleep(intervalMs, signal);
  }
}

async function waitForRun(
  deps: RunAgentDeps,
  stream: StreamRunEvents,
  runId: string,
  prId: string,
  signal: AbortSignal,
  onProgress: (msg: string) => void,
): Promise<void> {
  try {
    await stream(deps.config.apiBaseUrl, runId, {
      signal,
      onEvent: (e) => {
        if (e.msg) onProgress(e.msg);
      },
    });
  } catch {
    // Aborted = timeout (caller detects via signal). Any other failure → the
    // SSE path is unavailable, so fall back to polling run status.
    if (signal.aborted) return;
    await pollUntilTerminal(deps.api, prId, runId, signal, deps.config.pollIntervalMs);
  }
}

export function createRunAgentHandler(deps: RunAgentDeps) {
  const stream = deps.streamRunEvents ?? streamRunEvents;

  return async (args: RunAgentArgs, ctx: RunAgentCtx = {}): Promise<ToolResult> => {
    const onProgress = ctx.onProgress ?? (() => {});
    try {
      const started = await deps.api.startReview(args.pr_id, args.agent_id);
      const runId = started.run_id;
      onProgress(`Review started (run ${runId})`);

      const timeoutMs = args.timeout_ms ?? deps.config.runTimeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await waitForRun(deps, stream, runId, args.pr_id, controller.signal, onProgress);
      } finally {
        clearTimeout(timer);
      }

      if (controller.signal.aborted) {
        return textResult({
          status: "timeout",
          run_id: runId,
          pr_id: args.pr_id,
          hint: "Review still running. Call get_findings with this pr_id and run_id once it finishes.",
        });
      }

      const runs = await deps.api.listRuns(args.pr_id);
      const status = runs.find((r) => r.run_id === runId)?.status ?? null;
      if (status === "failed") {
        const error = runs.find((r) => r.run_id === runId)?.error ?? "unknown error";
        return toToolError(
          new Error(`The agent run failed: ${error}`),
          "Check the agent's provider/model configuration, then retry.",
        );
      }
      if (status === "cancelled") {
        return toToolError(new Error("The agent run was cancelled."));
      }
      if (status !== "done") {
        return textResult({
          status: "pending",
          run_id: runId,
          pr_id: args.pr_id,
          hint: "Review has not finished yet. Call get_findings with this pr_id and run_id shortly.",
        });
      }

      const reviews = await deps.api.reviewsForPull(args.pr_id);
      const review = reviews
        .filter((r) => r.kind === "review")
        .find((r) => r.run_id === runId);
      if (!review) {
        return textResult({
          status: "done",
          run_id: runId,
          verdict: null,
          score: null,
          summary: null,
          findings: [],
          findings_truncated: false,
          total_findings: 0,
        });
      }
      return textResult({ status: "done", ...mapReviewToConcise(review) });
    } catch (err) {
      return toToolError(
        err,
        "If the agent_id is wrong, call list_agents; if the pr_id is wrong, call list_pulls.",
      );
    }
  };
}

/** Build a progress sender from the SDK request extra (no-op without a token). */
function makeProgressSender(extra: {
  _meta?: { progressToken?: string | number };
  sendNotification: (n: {
    method: "notifications/progress";
    params: { progressToken: string | number; progress: number; message?: string };
  }) => Promise<void>;
}): (msg: string) => void {
  const token = extra._meta?.progressToken;
  let progress = 0;
  return (message: string) => {
    if (token === undefined || token === null) return;
    progress += 1;
    void extra
      .sendNotification({
        method: "notifications/progress",
        params: { progressToken: token, progress, message },
      })
      .catch(() => {});
  };
}

export function registerRunAgentOnPr(
  server: McpServer,
  api: ApiClient,
  config: Config,
): void {
  const handler = createRunAgentHandler({ api, config });
  server.registerTool(
    "run_agent_on_pr",
    {
      title: "Run a reviewer agent on a PR and wait for findings",
      description: DESCRIPTION,
      inputSchema: runAgentInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    (args, extra) => handler(args, { onProgress: makeProgressSender(extra) }),
  );
}
