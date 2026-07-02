# Insights — `@devdigest/mcp-server`

A running log of gotchas and non-obvious decisions for the local MCP server.
**Append-only** — never overwrite; correct with a dated note. Entry format:
`- **YYYY-MM-DD** — what to do/avoid and why (evidence: path/file.ts:line)`

## What Works

- **2026-06-29** — The server is a **thin HTTP client** to `@devdigest/api` (:3001)
  with its OWN minimal local Zod types for only the consumed fields — it does NOT
  vendor `@devdigest/shared` (no sync script exists in the repo) and does NOT import
  server code. Zod strips unknown keys, so extra API fields are ignored harmlessly;
  changing the API rarely breaks the client (evidence: src/api/types.ts, src/api/client.ts).
- **2026-06-29** — Tool handlers are written as `createXHandler(deps)` factories that
  return the bare async handler; `registerX(server, ...)` wraps them. This keeps
  handlers unit-testable with a mock ApiClient and isolates all SDK coupling to the
  register fns. The write tool's progress sending lives only in `registerRunAgentOnPr`
  (the handler takes a plain `onProgress` callback) (evidence: src/tools/run-agent-on-pr.ts).

## What Doesn't Work

- **2026-06-29** — A plain `{content, isError}` interface is NOT assignable to
  `registerTool`'s callback return type: the SDK's `CallToolResult` has an index
  signature `[x: string]: unknown` (for `_meta` etc.), so `ToolResult` must declare
  `[key: string]: unknown` or tsc rejects every handler with "Index signature for type
  'string' is missing" (evidence: src/errors.ts ToolResult).
- **2026-06-29** — `console.log` anywhere in `src/` corrupts the stdio MCP stream
  (stdout IS the protocol). All logging goes through the stderr-only `log` helper;
  never use `console.log`. Grep `src/` for it before shipping (evidence: src/logging.ts).
- **2026-06-29** — `pnpm typecheck`/`pnpm test` abort with `ERR_PNPM_IGNORED_BUILDS`
  (esbuild build scripts) via pnpm's deps-status pre-check on this machine. Run the
  local binaries directly to bypass it: `./node_modules/.bin/tsc --noEmit -p tsconfig.json`
  and `./node_modules/.bin/vitest run`.

## Codebase Patterns

- **2026-06-29** — There is **no `GET /runs/:id`** status endpoint on the API. Run
  status comes only from `GET /pulls/:id/runs` (a `RunSummary[]`), so both `get_findings`
  and `run_agent_on_pr` require the **pr_id**, not just a run_id. Findings come from
  `GET /pulls/:id/reviews` filtered by `run_id` AND `kind === 'review'` (a stray
  `'summary'` row can sit first) (evidence: src/tools/get-findings.ts selectReview).
- **2026-06-29** — `run_agent_on_pr` is BLOCKING by design ("outcome, not operation"):
  start → wait → fetch. The wait consumes SSE `GET /runs/:id/events`, which carries NO
  terminal-status payload — the stream simply CLOSES when the run reaches a terminal
  state. After it closes you MUST re-query `GET /pulls/:id/runs` to learn
  done/failed/cancelled. SSE-connect failure falls back to polling under the same
  AbortController; the timeout aborts both and returns `{status:'timeout', run_id}`
  (not an error) without cancelling the run (evidence: src/tools/run-agent-on-pr.ts waitForRun,
  src/api/sse.ts).
- **2026-06-29** — API response casing is mixed: `GET /agents` and `GET /repos` return
  raw Drizzle rows (**camelCase**: `systemPrompt`, `enabled`), while review/run/PR DTOs
  are **snake_case** (`start_line`, `run_id`). The local Zod types mirror each source's
  casing — don't assume one convention (evidence: src/api/types.ts).
- **2026-06-29** — `list_pulls` takes `repo_id` OPTIONAL: omitted → `GET /repos` then
  aggregate each repo's `GET /repos/:id/pulls` (capped at 100). This makes it
  self-sufficient so no separate `list_repos` tool is needed (the tool set is fixed at
  6). PRs without a UUID (`PrMeta.id` is nullish for unsynced) are dropped — you can't
  run/fetch on them (evidence: src/tools/list-pulls.ts).

## Tool & Library Notes

- **2026-06-29** — `eventsource-parser` v3 `createParser({ onEvent })` gives
  `EventSourceMessage` with `.event` (the SSE event name = the run event `kind`) and
  `.data` (JSON string of the `RunEvent`). Feed it the decoded `fetch` body stream
  chunks; resolve when `reader.read()` returns done (evidence: src/api/sse.ts).

## Recurring Errors & Fixes

## Session Notes

- **2026-06-29** — Initial build (Phases 0–3). Decisions locked with the user: local
  stdio · TS SDK · thin HTTP client to :3001 · single local workspace from env
  (`DEVDIGEST_WORKSPACE_ID` is inert — the API resolves the workspace server-side). The
  `get_conventions` data path required a NEW server route `GET /conventions[?repoId=]`
  (server/src/modules/conventions/). `get_blast_radius` is a deliberate stub. Full
  design: docs/mcp-server-development-plan.md.

## Open Questions

- **2026-06-29** — A future server `GET /runs/:id` (status) + `GET /runs/:id/review`
  would let `get_findings` and the wait loop work from a run_id alone, dropping the
  pr_id requirement on both tools.
