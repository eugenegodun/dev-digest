import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ApiClient } from "../api/client.js";
import type { PrMeta } from "../api/types.js";
import { textResult, toToolError, type ToolResult } from "../errors.js";

const MAX_PULLS = 100;

const DESCRIPTION =
  "Lists pull requests and returns each PR's UUID, GitHub number, title, state, " +
  "and its repo (id + name). Use this to get the pr_id (a UUID, NOT the GitHub " +
  "number) required by run_agent_on_pr / get_findings / get_blast_radius. Omit " +
  "repo_id to list PRs across all repos in the workspace; pass it to narrow to " +
  "one repo. Read-only.";

export const listPullsInput = {
  repo_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Repository UUID to scope the listing. Omit to list pulls across all repos in the workspace.",
    ),
};

interface PullOut {
  id: string;
  number: number;
  title: string;
  state: string;
  repo_id: string;
  repo_name: string;
}

function toPullOut(pr: PrMeta, repoId: string, repoName: string): PullOut | null {
  // PrMeta.id is nullish for PRs not yet persisted; we can only act on persisted
  // ones (run/findings need the UUID), so drop the rest.
  if (!pr.id) return null;
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.status,
    repo_id: repoId,
    repo_name: repoName,
  };
}

export function createListPullsHandler(api: ApiClient) {
  return async (args: { repo_id?: string }): Promise<ToolResult> => {
    try {
      const repos = args.repo_id
        ? [{ id: args.repo_id, name: args.repo_id }]
        : await api.listRepos();

      const pulls: PullOut[] = [];
      let truncated = false;
      for (const repo of repos) {
        const prs = await api.listPullsForRepo(repo.id);
        for (const pr of prs) {
          const out = toPullOut(pr, repo.id, repo.name);
          if (!out) continue;
          if (pulls.length >= MAX_PULLS) {
            truncated = true;
            break;
          }
          pulls.push(out);
        }
        if (truncated) break;
      }

      return textResult({ pulls, truncated, total: pulls.length });
    } catch (err) {
      return toToolError(
        err,
        "Verify the repo_id is valid — call list_pulls with no repo_id to see available repos and PRs.",
      );
    }
  };
}

export function registerListPulls(server: McpServer, api: ApiClient): void {
  server.registerTool(
    "list_pulls",
    {
      title: "List pull requests",
      description: DESCRIPTION,
      inputSchema: listPullsInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    createListPullsHandler(api),
  );
}
