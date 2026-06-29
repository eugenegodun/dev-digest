import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { textResult, type ToolResult } from "../errors.js";

const DESCRIPTION =
  "Reserved: will return the PR's impact map (changed symbols and their callers " +
  "/ dependents). NOT IMPLEMENTED YET — currently returns a structured " +
  "'not_implemented' response. Performs no analysis.";

export const getBlastRadiusInput = {
  pr_id: z
    .string()
    .uuid()
    .describe("The PR UUID to compute impact for (reserved; not yet used)."),
};

export function createGetBlastRadiusHandler() {
  return async (args: { pr_id: string }): Promise<ToolResult> =>
    textResult({
      status: "not_implemented",
      pr_id: args.pr_id,
      message:
        "Blast radius is not available yet. A dedicated impact map will be added later.",
    });
}

export function registerGetBlastRadius(server: McpServer): void {
  server.registerTool(
    "get_blast_radius",
    {
      title: "Get PR blast radius (not implemented)",
      description: DESCRIPTION,
      inputSchema: getBlastRadiusInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    createGetBlastRadiusHandler(),
  );
}
