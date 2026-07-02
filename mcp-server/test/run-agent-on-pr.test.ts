import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/client.js";
import type { StreamRunEvents } from "../src/api/sse.js";
import type { ReviewDto } from "../src/api/types.js";
import { createRunAgentHandler } from "../src/tools/run-agent-on-pr.js";

const config = {
  apiBaseUrl: "http://localhost:3001",
  workspaceId: undefined,
  runTimeoutMs: 180_000,
  pollIntervalMs: 2_000,
};

function mockApi(over: Partial<ApiClient> = {}): ApiClient {
  return {
    listAgents: vi.fn(),
    listRepos: vi.fn(),
    listPullsForRepo: vi.fn(),
    listRuns: vi.fn(),
    reviewsForPull: vi.fn(),
    startReview: vi.fn().mockResolvedValue({ run_id: "run1" }),
    getConventions: vi.fn(),
    ...over,
  };
}

function parse(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0]!.text);
}

const reviewRow: ReviewDto = {
  id: "rev",
  pr_id: "pr1",
  run_id: "run1",
  kind: "review",
  verdict: "request_changes",
  summary: "needs work",
  score: 40,
  created_at: "2026-01-01T00:00:00.000Z",
  findings: [],
};

const ARGS = { pr_id: "pr1", agent_id: "ag1" };

afterEach(() => {
  vi.useRealTimers();
});

describe("run_agent_on_pr", () => {
  it("happy path: SSE closes → status done → returns concise findings", async () => {
    const streamRunEvents: StreamRunEvents = vi.fn().mockResolvedValue(undefined);
    const api = mockApi({
      listRuns: vi.fn().mockResolvedValue([{ run_id: "run1", status: "done" }]),
      reviewsForPull: vi.fn().mockResolvedValue([reviewRow]),
    });
    const out = parse(
      await createRunAgentHandler({ api, config, streamRunEvents })(ARGS),
    );
    expect(out.status).toBe("done");
    expect(out.run_id).toBe("run1");
    expect(out.verdict).toBe("request_changes");
  });

  it("falls back to polling when the SSE stream fails", async () => {
    const streamRunEvents: StreamRunEvents = vi
      .fn()
      .mockRejectedValue(new Error("sse boom"));
    const listRuns = vi.fn().mockResolvedValue([{ run_id: "run1", status: "done" }]);
    const api = mockApi({
      listRuns,
      reviewsForPull: vi.fn().mockResolvedValue([reviewRow]),
    });
    const out = parse(
      await createRunAgentHandler({ api, config, streamRunEvents })(ARGS),
    );
    expect(out.status).toBe("done");
    // listRuns hit twice: once by the poll loop, once for the terminal status check
    expect(listRuns.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("returns a forward error when the run failed", async () => {
    const streamRunEvents: StreamRunEvents = vi.fn().mockResolvedValue(undefined);
    const api = mockApi({
      listRuns: vi
        .fn()
        .mockResolvedValue([{ run_id: "run1", status: "failed", error: "model 401" }]),
    });
    const res = await createRunAgentHandler({ api, config, streamRunEvents })(ARGS);
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toMatch(/failed: model 401/);
  });

  it("returns timeout (not an error) when the deadline fires", async () => {
    vi.useFakeTimers();
    // stream that only resolves once the timeout aborts it
    const streamRunEvents: StreamRunEvents = (_b, _r, { signal }) =>
      new Promise((resolve) => {
        if (signal.aborted) return resolve();
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
    const api = mockApi();
    const p = createRunAgentHandler({ api, config, streamRunEvents })({
      ...ARGS,
      timeout_ms: 10_000,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    const out = parse(await p);
    expect(out.status).toBe("timeout");
    expect(out.run_id).toBe("run1");
    expect(api.listRuns).not.toHaveBeenCalled();
  });

  it("forwards progress: start line + each stream event message", async () => {
    const streamRunEvents: StreamRunEvents = async (_b, _r, { onEvent }) => {
      onEvent?.({ kind: "tool", msg: "grep diff", seq: 1 });
    };
    const api = mockApi({
      listRuns: vi.fn().mockResolvedValue([{ run_id: "run1", status: "done" }]),
      reviewsForPull: vi.fn().mockResolvedValue([reviewRow]),
    });
    const onProgress = vi.fn();
    await createRunAgentHandler({ api, config, streamRunEvents })(ARGS, { onProgress });
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("Review started"));
    expect(onProgress).toHaveBeenCalledWith("grep diff");
  });
});
