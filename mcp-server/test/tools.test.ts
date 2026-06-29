import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/client.js";
import type { ReviewDto } from "../src/api/types.js";
import { ApiError } from "../src/errors.js";
import { createGetBlastRadiusHandler } from "../src/tools/get-blast-radius.js";
import { createGetConventionsHandler } from "../src/tools/get-conventions.js";
import { createGetFindingsHandler } from "../src/tools/get-findings.js";
import { createListAgentsHandler } from "../src/tools/list-agents.js";
import { createListPullsHandler } from "../src/tools/list-pulls.js";

function mockApi(over: Partial<ApiClient> = {}): ApiClient {
  return {
    listAgents: vi.fn(),
    listRepos: vi.fn(),
    listPullsForRepo: vi.fn(),
    listRuns: vi.fn(),
    reviewsForPull: vi.fn(),
    startReview: vi.fn(),
    getConventions: vi.fn(),
    ...over,
  };
}

function parse(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0]!.text);
}

describe("list_agents", () => {
  it("returns mapped agents", async () => {
    const api = mockApi({
      listAgents: vi.fn().mockResolvedValue([
        { id: "a1", name: "Sec", provider: "openai", model: "gpt", enabled: true, description: "d" },
      ]),
    });
    const out = parse(await createListAgentsHandler(api)());
    expect(out.agents).toEqual([
      { id: "a1", name: "Sec", provider: "openai", model: "gpt", enabled: true, description: "d" },
    ]);
  });

  it("returns a forward-leading error when the API is down", async () => {
    const api = mockApi({
      listAgents: vi
        .fn()
        .mockRejectedValue(new ApiError("down", 0, "network_error")),
    });
    const res = await createListAgentsHandler(api)();
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toMatch(/Start it with `pnpm dev`/);
  });
});

describe("list_pulls", () => {
  it("aggregates across repos and drops PRs without a UUID", async () => {
    const api = mockApi({
      listRepos: vi.fn().mockResolvedValue([{ id: "r1", name: "repo-one" }]),
      listPullsForRepo: vi.fn().mockResolvedValue([
        { id: "pr1", number: 7, title: "feat", author: "x", status: "open" },
        { id: null, number: 8, title: "unsynced", author: "x", status: "open" },
      ]),
    });
    const out = parse(await createListPullsHandler(api)({}));
    expect(out.pulls).toEqual([
      { id: "pr1", number: 7, title: "feat", state: "open", repo_id: "r1", repo_name: "repo-one" },
    ]);
    expect(out.total).toBe(1);
  });

  it("scopes to one repo without calling listRepos", async () => {
    const listRepos = vi.fn();
    const api = mockApi({
      listRepos,
      listPullsForRepo: vi
        .fn()
        .mockResolvedValue([{ id: "pr1", number: 7, title: "t", author: "x", status: "open" }]),
    });
    await createListPullsHandler(api)({ repo_id: "r9" });
    expect(listRepos).not.toHaveBeenCalled();
    expect(api.listPullsForRepo).toHaveBeenCalledWith("r9");
  });
});

describe("get_findings", () => {
  const base: ReviewDto = {
    id: "rev",
    pr_id: "pr1",
    run_id: "run1",
    kind: "review",
    verdict: "approve",
    summary: "ok",
    score: 90,
    created_at: "2026-01-01T00:00:00.000Z",
    findings: [],
  };

  it("returns no_review with a hint when none exist", async () => {
    const api = mockApi({ reviewsForPull: vi.fn().mockResolvedValue([]) });
    const out = parse(await createGetFindingsHandler(api)({ pr_id: "pr1" }));
    expect(out.status).toBe("no_review");
    expect(out.hint).toMatch(/run_agent_on_pr/);
  });

  it("filters by run_id when given", async () => {
    const api = mockApi({
      reviewsForPull: vi.fn().mockResolvedValue([
        base,
        { ...base, id: "rev2", run_id: "run2", verdict: "comment" },
      ]),
    });
    const out = parse(await createGetFindingsHandler(api)({ pr_id: "pr1", run_id: "run2" }));
    expect(out.status).toBe("done");
    expect(out.run_id).toBe("run2");
    expect(out.verdict).toBe("comment");
  });

  it("returns the newest review when run_id omitted", async () => {
    const api = mockApi({
      reviewsForPull: vi.fn().mockResolvedValue([
        { ...base, run_id: "old", created_at: "2026-01-01T00:00:00.000Z" },
        { ...base, run_id: "new", created_at: "2026-02-01T00:00:00.000Z" },
      ]),
    });
    const out = parse(await createGetFindingsHandler(api)({ pr_id: "pr1" }));
    expect(out.run_id).toBe("new");
  });

  it("ignores non-review kinds", async () => {
    const api = mockApi({
      reviewsForPull: vi.fn().mockResolvedValue([{ ...base, kind: "summary" }]),
    });
    const out = parse(await createGetFindingsHandler(api)({ pr_id: "pr1" }));
    expect(out.status).toBe("no_review");
  });
});

describe("get_conventions", () => {
  it("maps rows to {rule,file,accepted,confidence}", async () => {
    const api = mockApi({
      getConventions: vi.fn().mockResolvedValue([
        {
          id: "c1",
          repo_id: "r1",
          rule: "Prefer named exports",
          evidence_path: "src/index.ts",
          evidence_snippet: null,
          confidence: 0.9,
          accepted: true,
        },
      ]),
    });
    const out = parse(await createGetConventionsHandler(api)({}));
    expect(out.conventions).toEqual([
      { rule: "Prefer named exports", file: "src/index.ts", accepted: true, confidence: 0.9 },
    ]);
    expect(out.message).toBeUndefined();
  });

  it("returns an empty list with a message when none exist", async () => {
    const api = mockApi({ getConventions: vi.fn().mockResolvedValue([]) });
    const out = parse(await createGetConventionsHandler(api)({}));
    expect(out.conventions).toEqual([]);
    expect(out.message).toMatch(/No conventions/);
  });

  it("passes repo_id through to the client", async () => {
    const getConventions = vi.fn().mockResolvedValue([]);
    const api = mockApi({ getConventions });
    await createGetConventionsHandler(api)({ repo_id: "r9" });
    expect(getConventions).toHaveBeenCalledWith("r9");
  });
});

describe("get_blast_radius", () => {
  it("returns a not_implemented stub without touching the API", async () => {
    const out = parse(await createGetBlastRadiusHandler()({ pr_id: "pr1" }));
    expect(out.status).toBe("not_implemented");
    expect(out.pr_id).toBe("pr1");
  });
});
