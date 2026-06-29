import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ApiClient } from "../api/client.js";
import { textResult, toToolError, type ToolResult } from "../errors.js";

const DESCRIPTION =
  "Lists the configured DevDigest reviewer agents for this workspace and returns " +
  "each agent's id, name, provider, model, and enabled flag. Call this FIRST to " +
  "obtain a valid agent_id for run_agent_on_pr. Read-only; does not start a " +
  "review or read PR data.";

export function createListAgentsHandler(api: ApiClient) {
  return async (): Promise<ToolResult> => {
    try {
      const agents = await api.listAgents();
      return textResult({
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          provider: a.provider,
          model: a.model,
          enabled: a.enabled,
          description: a.description ?? null,
        })),
      });
    } catch (err) {
      return toToolError(err);
    }
  };
}

export function registerListAgents(server: McpServer, api: ApiClient): void {
  server.registerTool(
    "list_agents",
    {
      title: "List reviewer agents",
      description: DESCRIPTION,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    createListAgentsHandler(api),
  );
}
