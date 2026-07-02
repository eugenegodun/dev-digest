import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createApiClient } from "./api/client.js";
import { loadConfig } from "./config.js";
import { log } from "./logging.js";
import { registerTools } from "./tools/registry.js";

const INSTRUCTIONS =
  "DevDigest code review. Use list_pulls to get a PR's UUID and list_agents to " +
  "get a valid agent_id (the PR UUID is not its GitHub number). run_agent_on_pr " +
  "starts a review and BLOCKS until findings are ready — do not poll. Use " +
  "get_findings only to read an already-finished run.";

async function main(): Promise<void> {
  const config = loadConfig();

  const server = new McpServer(
    { name: "devdigest", version: "0.0.0" },
    { instructions: INSTRUCTIONS },
  );

  const api = createApiClient(config);
  registerTools(server, { config, api });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info("MCP server connected over stdio", { apiBaseUrl: config.apiBaseUrl });
}

main().catch((err: unknown) => {
  log.error("Fatal: failed to start MCP server", err instanceof Error ? err.message : err);
  process.exit(1);
});
