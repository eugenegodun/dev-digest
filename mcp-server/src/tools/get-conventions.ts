import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ApiClient } from "../api/client.js";
import { textResult, toToolError, type ToolResult } from "../errors.js";

const DESCRIPTION =
  "Returns the learned repository coding conventions (each a rule with its " +
  "evidence file and acceptance flag). Read-only; analyses no code and starts " +
  "nothing. Convention extraction may not have run yet, in which case this " +
  "returns an empty list with an explanatory message rather than failing. Omit " +
  "repo_id for workspace-wide conventions, or pass it to scope to one repo.";

export const getConventionsInput = {
  repo_id: z
    .string()
    .uuid()
    .optional()
    .describe("Optional repo UUID (from list_pulls) to scope conventions; omit for workspace-wide."),
};

export function createGetConventionsHandler(api: ApiClient) {
  return async (args: { repo_id?: string }): Promise<ToolResult> => {
    try {
      const rows = await api.getConventions(args.repo_id);
      const conventions = rows.map((c) => ({
        rule: c.rule,
        file: c.evidence_path,
        accepted: c.accepted,
        confidence: c.confidence,
      }));
      return textResult(
        conventions.length === 0
          ? {
              conventions,
              message:
                "No conventions have been extracted yet for this workspace.",
            }
          : { conventions },
      );
    } catch (err) {
      return toToolError(
        err,
        "If repo_id was provided, verify it with list_pulls; or call without repo_id.",
      );
    }
  };
}

export function registerGetConventions(server: McpServer, api: ApiClient): void {
  server.registerTool(
    "get_conventions",
    {
      title: "Get repository conventions",
      description: DESCRIPTION,
      inputSchema: getConventionsInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    createGetConventionsHandler(api),
  );
}
