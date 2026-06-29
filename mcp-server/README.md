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

> This server is **standalone**. The repo bootstrap `./scripts/dev.sh` brings up
> only Postgres + API + web — it does **not** start the MCP server. Run it
> separately, on demand, with the steps below.

## Run from scratch

Prereqs: Node ≥ 22 · pnpm ≥ 10 · Docker (for Postgres). A real
`run_agent_on_pr` needs an LLM key (OpenAI / Anthropic / OpenRouter);
`list_agents` / `list_pulls` / `get_conventions` do not.

### 1. Bring up the engine (API on :3001)

```bash
# from the repo root — Postgres → migrate → seed → API (+ web)
./scripts/dev.sh                # everything
./scripts/dev.sh --no-client    # Postgres + API only
```

LLM / GitHub keys for real reviews go in `server/.env` (the script seeds it from
`.env.example`) or `~/.devdigest/secrets.json`:

```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GITHUB_TOKEN=...        # to sync PRs from GitHub
```

Verify it's up: `curl -s localhost:3001/agents | head`.

Manual alternative (no script):

```bash
docker compose up -d
cd server && pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev
```

### 2. Start this MCP server (separate terminal)

```bash
cd mcp-server
pnpm install            # first time
cp .env.example .env    # optional; defaults are fine
pnpm dev                # tsx src/index.ts — speaks MCP over stdio
# production-style:
pnpm build && pnpm start
```

> stdout is the MCP protocol. All logging goes to **stderr** — never `console.log`.
> If `pnpm` aborts with `ERR_PNPM_IGNORED_BUILDS`, run the binary directly:
> `./node_modules/.bin/tsx src/index.ts`.

## Testing

```bash
# unit tests (mock the HTTP boundary — no API needed)
pnpm test
# or, if pnpm's pre-check aborts:
./node_modules/.bin/vitest run
```

The server-side conventions route has an integration test (real Postgres via
testcontainers, needs Docker): `cd ../server && pnpm exec vitest run conventions.it.test`.

Manual checks against a running server:

- **MCP Inspector (interactive GUI)** — best for poking tools by hand:
  ```bash
  npx @modelcontextprotocol/inspector pnpm dev
  ```
- **Raw stdio smoke** — `tools/list` needs no API; a `tools/call` needs the API up:
  ```bash
  printf '%s\n%s\n%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cli","version":"0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
    | ./node_modules/.bin/tsx src/index.ts 2>/dev/null
  ```

Live end-to-end flow (API must be up): `list_pulls` → take a `pr_id` →
`list_agents` → take an `agent_id` → `run_agent_on_pr {pr_id, agent_id}` (blocks,
returns `{verdict, findings[]}`) → `get_findings {pr_id, run_id}` to re-read.

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
