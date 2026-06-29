# @devdigest/mcp-server

Local MCP server for DevDigest. A thin **stdio** client over the
[`@devdigest/api`](../server) review engine (`:3001`) that exposes reviewer tools
to MCP hosts (Claude Code / Claude Desktop).

Design and rationale: [`../docs/mcp-server-development-plan.md`](../docs/mcp-server-development-plan.md).

## Tools

| Tool | Kind | Purpose |
|---|---|---|
| `list_agents` | read | List configured reviewer agents → valid `agent_id` |
| `list_pulls` | read | List a repo's PRs → valid `pr_id` (UUID, not GitHub number) |
| `run_agent_on_pr` | write | Run an agent on a PR, **block** until findings ready |
| `get_findings` | read | Verdict + findings for an already-finished run |
| `get_conventions` | read | Repository coding conventions |
| `get_blast_radius` | read | PR impact map (stub — not implemented yet) |

## Prerequisites

The DevDigest API must be running with a migrated + seeded DB:

```bash
cd ../server
pnpm db:migrate && pnpm db:seed && pnpm dev   # serves :3001
```

## Develop

```bash
pnpm install
pnpm dev         # tsx src/index.ts — speaks MCP over stdio
pnpm typecheck
pnpm test
```

> stdout is the MCP protocol. All logging goes to **stderr** — never `console.log`.

## Configuration (env)

| Var | Default | Notes |
|---|---|---|
| `DEVDIGEST_API_BASE_URL` | `http://localhost:3001` | API base URL |
| `DEVDIGEST_WORKSPACE_ID` | — | Forward-compat only; API ignores it today |
| `DEVDIGEST_RUN_TIMEOUT_MS` | `180000` | `run_agent_on_pr` block cap |
| `DEVDIGEST_POLL_INTERVAL_MS` | `2000` | SSE-unavailable poll cadence |

## Add to a host

```jsonc
{
  "mcpServers": {
    "devdigest": {
      "command": "node",
      "args": ["<abs>/dev-digest/mcp-server/dist/index.js"],
      "env": {
        "DEVDIGEST_API_BASE_URL": "http://localhost:3001",
        "DEVDIGEST_RUN_TIMEOUT_MS": "180000"
      }
    }
  }
}
```

Build first (`pnpm build`). For dev, point `command` at `tsx` and `args` at
`src/index.ts`, or use `claude mcp add` in Claude Code.
