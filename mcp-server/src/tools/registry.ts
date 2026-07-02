import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ApiClient } from "../api/client.js";
import type { Config } from "../config.js";
import { registerGetBlastRadius } from "./get-blast-radius.js";
import { registerGetConventions } from "./get-conventions.js";
import { registerGetFindings } from "./get-findings.js";
import { registerListAgents } from "./list-agents.js";
import { registerListPulls } from "./list-pulls.js";
import { registerRunAgentOnPr } from "./run-agent-on-pr.js";

export interface ToolDeps {
  config: Config;
  api: ApiClient;
}

/**
 * Registers every tool onto the server.
 *
 * Phase 1: read tools (list_agents, list_pulls, get_findings).
 * Phase 2: run_agent_on_pr.
 * Phase 3: get_conventions (real) + get_blast_radius (stub).
 */
export function registerTools(server: McpServer, deps: ToolDeps): void {
  registerListAgents(server, deps.api);
  registerListPulls(server, deps.api);
  registerGetFindings(server, deps.api);
  registerRunAgentOnPr(server, deps.api, deps.config);
  registerGetConventions(server, deps.api);
  registerGetBlastRadius(server);
}
