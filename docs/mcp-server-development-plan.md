# Development Plan — `mcp-server/` (Local MCP Server for DevDigest)

> Status: approved design, pre-implementation.
> Scope: a **local** MCP server exposing tools that wrap the existing DevDigest
> review functionality, so an MCP host (Claude Code / Desktop) can drive reviews.

## Locked decisions

| Decision | Choice |
|---|---|
| Deployment | **Local only**, stdio transport (host launches the process) |
| Framework | Official TypeScript SDK `@modelcontextprotocol/sdk` |
| Package | New sibling package `mcp-server/` (own `package.json` + lockfile; no workspace) |
| Wiring | **Thin HTTP client** to `@devdigest/api` on `:3001` — reuse its orchestration/persistence/SSE; no DB access, no duplicated review logic |
| Workspace | Single local workspace; resolved server-side. Tools take **no** workspace arg |
| Tool count | **6** (5 from spec + `list_pulls`) |
| Conventions | **Real** — add a server route `GET /conventions`, then read it |
| Types | Minimal **local** types/zod for consumed fields (no vendoring; no sync script exists) |

## Tool design principles (from the spec)

1. **Outcome, not operation** — tools return results, not low-level ops. Drives
   `run_agent_on_pr` blocking behaviour (start → wait → fetch findings, itself).
2. **Flat arguments** — `repo`, `pr`, `agent` as separate scalar values, never
   nested objects (non-Anthropic models err more on nested input).
3. **Concise structured response** — return only needed fields (`{verdict, findings[]}`),
   never a raw dump. One full review can be tens of thousands of tokens.
4. **Errors lead forward** — error messages suggest the next action
   ("agent not found — call `list_agents`"), returned as MCP tool errors
   (`isError:true`), never as transport-crashing exceptions.

Plus Anthropic MCP best practices: `readOnlyHint`/`destructiveHint`/`title`
annotations on every tool; tight Zod input schemas with `.describe()` on every
param; tool names ≤ 64 chars; compact schemas (token economy); a one-line server
`instructions` field for cross-tool hints.

---

## Grounding facts (verified against the codebase)

- **API is no-auth, single-workspace, local.** `LocalNoAuthProvider`
  (`server/src/adapters/auth/local.ts`) resolves user+workspace server-side from
  the DB default workspace and ignores client-supplied workspace. MCP sends no
  auth; `DEVDIGEST_WORKSPACE_ID` is forward-compat only (currently inert).
- **PRs are addressed by UUID `:id`** (`server/src/modules/pulls/routes.ts`), not
  GitHub number. Obtain via `list_pulls` → `GET /repos/:id/pulls`.
- **Start a run:** `POST /pulls/:id/review { agentId }` → `{ pr_id, runs:[{run_id,
  agent_id, agent_name}], reviews:[] }` immediately; review runs in background
  (`server/src/modules/reviews/routes.ts:27-44`, `service.ts:104-139`). `reviews`
  is always empty on this response.
- **Wait for completion:**
  - SSE `GET /runs/:id/events` (run-id only) — replays buffered events then
    streams live; **closes on done**; no explicit terminal-status payload
    (`reviews/routes.ts:48-92`; event kinds `info|tool|result|error`).
  - Poll `GET /pulls/:id/runs` → `RunSummary[]` with `status`
    (`running|done|failed|cancelled`), `score`, `findings_count`, `blockers`,
    `error` (`trace.ts:97-119`). **Requires the PR id**, not just run id.
- **Fetch findings:** `GET /pulls/:id/reviews` → `ReviewDto[]` (`service.ts:161-184`,
  `helpers.ts:18-58`) with `verdict|summary|score|findings[]`; each finding has
  `severity|category|title|file|start_line|end_line|rationale|suggestion|
  confidence|kind`. **No `GET /reviews/:runId`** — filter by `run_id`. ⇒
  `get_findings` and `run_agent_on_pr` both need the **pr_id**.
- **No `GET /runs/:id`** — status only via `GET /pulls/:id/runs`.
- **Conventions:** table exists (`knowledge.ts:31-42`) but **no route** ⇒ we add
  `GET /conventions` server-side.
- **Blast radius:** no dedicated route; computed only inside `GET /pulls/:id/brief`
  ⇒ `get_blast_radius` ships as a stub.
- **Cross-package convention:** each package owns `package.json`+lockfile; shared
  via tsconfig path aliases; `src/vendor/shared` is vendored, never hand-edited.

---

## 1. Package scaffold

```
mcp-server/
  package.json        # @devdigest/mcp-server, type:module, bin: devdigest-mcp
  tsconfig.json       # mirror server/tsconfig.json (ES2022, NodeNext bundler, strict)
  README.md           # launch + host-config instructions
  .env.example
  src/
    index.ts          # build McpServer, register tools, connect StdioServerTransport
    config.ts         # loadConfig() from env, Zod-validated, fail-fast to stderr
    logging.ts        # stderr-ONLY logger (stdout is the protocol)
    api/
      client.ts       # thin typed fetch wrapper over :3001 + ApiError
      types.ts        # minimal local types for consumed DTOs (+ zod for validation)
      sse.ts          # SSE consumer for GET /runs/:id/events (eventsource-parser)
    tools/
      registry.ts     # registers all 6 tools onto the McpServer
      list-agents.ts
      list-pulls.ts
      run-agent-on-pr.ts
      get-findings.ts
      get-conventions.ts
      get-blast-radius.ts
    shape/
      findings.ts      # mapReviewToConcise(): ReviewDto -> {verdict, findings[]}
    errors.ts          # toToolError(): map ApiError/thrown -> {isError, forward hint}
  test/
    *.test.ts          # hermetic (mock fetch / mock client)
    *.it.test.ts       # opt-in, against a running :3001 (excluded from default run)
```

**`package.json`** (mirror siblings):
- `name: @devdigest/mcp-server`, `private: true`, `type: module`, `version: 0.0.0`.
- `bin: { "devdigest-mcp": "dist/index.js" }`.
- scripts: `dev: tsx src/index.ts`, `build: tsc -p tsconfig.json`,
  `start: node dist/index.js`, `typecheck: tsc --noEmit -p tsconfig.json`,
  `test: vitest run`, `test:it: vitest run .it.test`.
- deps: `@modelcontextprotocol/sdk` ^1.x, `zod` ^3.24.1 (lockstep with server),
  `eventsource-parser` ^3.x. Built-in `fetch` (Node 22) — no axios.
- devDeps: `@types/node` ^22.10, `tsx` ^4.19.2, `typescript` ^5.7.2, `vitest` ^2.1.8.

**`tsconfig.json`**: copy `server/tsconfig.json` compiler options. Paths: none
required (no vendoring). `outDir: dist`, `include: ["src/**/*.ts"]`.

**`config.ts` / `.env.example`** (Zod-validated at boot):
- `DEVDIGEST_API_BASE_URL` (default `http://localhost:3001`).
- `DEVDIGEST_WORKSPACE_ID` (optional uuid; inert today — documented).
- `DEVDIGEST_RUN_TIMEOUT_MS` (default `180000`).
- `DEVDIGEST_POLL_INTERVAL_MS` (default `2000`).
Invalid config → exit non-zero, message to **stderr**.

**Launch (stdio):** host spawns the process; protocol over stdin/stdout via
`StdioServerTransport`. **Hard rule:** stdout = protocol only — all logging to
stderr. The DevDigest API must already run on `:3001`.

---

## 2. API client layer (`src/api/`)

Separate from tool definitions (unit-testable by mocking `fetch`). Mirror
`client/src/lib/api.ts` envelope handling (`{error:{code,message,details}}` →
typed `ApiError`; network-down → "is the API running on :3001?" message).

Methods:
- `listAgents()` → `GET /agents`
- `listPulls(repoId)` → `GET /repos/:id/pulls`
- `startReview(prId, agentId)` → `POST /pulls/:id/review { agentId }` → `runs[0]`
- `listRuns(prId)` → `GET /pulls/:id/runs` (status/score/findings_count/blockers/error)
- `reviewsForPull(prId)` → `GET /pulls/:id/reviews` (verdict + findings source)
- `getConventions(repoId?)` → `GET /conventions[?repoId=]` (**new server route**)

`sse.ts` — `streamRunEvents(runId, { signal, onEvent }): Promise<void>` resolving
when the stream closes (= run terminal). Uses `fetch` body stream +
`eventsource-parser`. After close, caller re-queries `listRuns(prId)` for the
authoritative terminal status.

`types.ts` — minimal local types for: `AgentSummary`, `PullSummary`, `RunSummary`,
`ReviewDto`, `Finding`, `Verdict`. Validate responses with small local zod
schemas for the fields actually consumed.

---

## 3. The 6 tools

Common: registered via `server.registerTool(name, {title, description,
inputSchema, annotations}, handler)`; flat Zod raw shape, every field
`.describe()`d; handlers never throw to transport — `try/catch` →
`errors.ts#toToolError`; success returns `content:[{type:'text',
text: JSON.stringify(concise)}]`.

### 3.1 `list_agents` (read-only)
- annotations `{ readOnlyHint:true, idempotentHint:true, openWorldHint:false }`
- input: `{}`
- desc: "Lists configured DevDigest reviewer agents (id, name, provider, model,
  enabled). Call FIRST to get a valid `agent_id` for `run_agent_on_pr`. Read-only;
  does not start a review."
- returns: `{ agents:[{id,name,provider,model,enabled,description}] }` (drop
  system_prompt/output_schema/versions).
- error-forward: network down → "Cannot reach the DevDigest API at <base>. Start
  it with `pnpm dev` in server/ (port 3001), then retry."

### 3.2 `list_pulls` (read-only) — NEW
- annotations `{ readOnlyHint:true, idempotentHint:true, openWorldHint:false }`
- input: `repo_id: z.string().uuid().optional().describe("Repository UUID to scope
  the listing. OMIT to list pulls across all repos in the workspace.")`
- desc: "Lists pull requests and returns each PR's UUID, GitHub number, title,
  state, and its repo (id + name). Use this to get the `pr_id` (a UUID, NOT the
  GitHub number) required by run_agent_on_pr / get_findings / get_blast_radius.
  Omit repo_id to see every PR; pass it to narrow to one repo. Read-only."
- returns: `{ pulls:[{ id, number, title, state, repo_id, repo_name }] }`
- logic: verified endpoints — `GET /repos` (list repos) and `GET /repos/:id/pulls`
  → `PrMeta[]` (`server/src/modules/pulls/routes.ts:27`). When `repo_id` given,
  call `/repos/:id/pulls`. When omitted, `GET /repos` then aggregate each repo's
  pulls (small N in a local single-workspace setup; cap the total and flag if
  truncated). This makes `list_pulls` self-sufficient — no separate `list_repos`
  tool needed (keeps the count at 6).

### 3.3 `run_agent_on_pr` (write — the only one) — blocking
- annotations `{ readOnlyHint:false, destructiveHint:false, idempotentHint:false,
  openWorldHint:true }`
- input (flat scalars):
  - `pr_id: z.string().uuid().describe("PR UUID from list_pulls. NOT the GitHub number.")`
  - `agent_id: z.string().uuid().describe("Reviewer agent UUID from list_agents.")`
  - `timeout_ms: z.number().int().min(10000).max(600000).optional().describe("Max
    block time. Default ~180000. If exceeded, returns run_id + a hint to call
    get_findings later.")`
- desc: "Runs ONE reviewer agent on ONE PR and BLOCKS until the review completes,
  then returns verdict + findings. Performs all three steps itself: start, wait,
  fetch — no polling needed. Use to START a new review. To read an
  already-finished run, use get_findings. On timeout returns
  `{status:'timeout', run_id, pr_id, hint}`."
- returns (success): `{ status:'done', run_id, verdict, score, summary,
  findings:ConciseFinding[], findings_truncated, total_findings }`
- execution:
  1. `startReview(pr_id, agent_id)` → `run_id`. 404 → forward hint (agent vs pr).
  2. emit MCP progress notification "review started (run <id>)".
  3. wait with `AbortController` armed at `timeout_ms ?? config.runTimeoutMs`:
     - primary: `streamRunEvents(run_id, {signal, onEvent})`, throttled progress
       notifications per event;
     - on stream close → `listRuns(pr_id)`, find `run_id`, read `status`:
       `done`→step 4; `failed`→`isError` with row.error + forward hint;
       `cancelled`→tool error;
     - fallback (SSE connect throws): poll `listRuns(pr_id)` every
       `pollIntervalMs` until terminal or abort.
  4. `reviewsForPull(pr_id)` → review where `run_id===run_id` → concise shape.
  5. timeout → NOT an error → `{status:'timeout', run_id, pr_id, hint}`; do not
     cancel the run (leave it for later `get_findings`).

### 3.4 `get_findings` (read-only)
- annotations `{ readOnlyHint:true, idempotentHint:true, openWorldHint:false }`
- input: `pr_id: z.string().uuid().describe(...)`,
  `run_id: z.string().uuid().optional().describe("Specific run; omit for the most
  recent completed review.")`
- desc: "Returns verdict + findings for an ALREADY-COMPLETED review on a PR.
  Read-only: does NOT start a review and does NOT wait — if none has finished it
  returns an empty result with a hint. To START a review, use run_agent_on_pr."
- returns: same concise shape, or `{status:'no_review', hint}`.

### 3.5 `get_conventions` (read-only) — real, via new server route
- annotations `{ readOnlyHint:true, idempotentHint:true, openWorldHint:false }`
- input: `repo_id: z.string().uuid().optional().describe("Repo UUID to scope
  conventions; omit for workspace-wide.")`
- desc: "Returns learned repository coding conventions (rule + evidence).
  Read-only; analyses nothing."
- returns: `{ conventions:[{ rule, file, accepted, confidence }] }` (mapped from
  `GET /conventions`; empty list when none extracted yet).
- **server work (in scope):** add `server/src/modules/conventions/` (routes +
  service + repository) reading the `conventions` table
  (`knowledge.ts:31-42`), workspace-scoped, optional `repoId` filter; register in
  `src/modules/index.ts`. Schema-first Zod params/response per server convention.

### 3.6 `get_blast_radius` (read-only) — stub
- annotations `{ readOnlyHint:true, idempotentHint:true, openWorldHint:false }`
- input: `pr_id: z.string().uuid().describe("PR UUID (reserved; not yet used).")`
- desc: "Reserved: will return the PR's impact map (changed symbols + callers).
  NOT IMPLEMENTED YET — returns a structured 'not implemented' response."
- returns: `{ status:'not_implemented', pr_id, message }` (normal, not isError).

### 3.7 Concise shaping (`shape/findings.ts`)
`mapReviewToConcise(review, {maxFindings=25})`:
- per finding keep only `{severity, category, file, start_line, end_line, title,
  suggestion}` + `rationale` truncated ~240 chars; drop `evidence`,
  `trifecta_components`, `confidence`, `id`, timestamps.
- sort CRITICAL→WARNING→SUGGESTION; cap at `maxFindings`; set
  `findings_truncated`, always include `total_findings`.
- top-level `{run_id, verdict, score, summary}`; `summary` truncated ~500 chars.

### 3.8 `errors.ts`
`toToolError(err)` → `{isError:true, content:[{type:'text', text}]}`. Maps known
`ApiError` codes/status to forward-leading messages; generic fallback. Guarantees
no exception reaches the stdio transport.

---

## 4. Server `instructions` one-liner

> "DevDigest code review. Use list_pulls to get a PR's UUID and list_agents to get
> a valid agent_id (the PR UUID is not its GitHub number). run_agent_on_pr starts a
> review and BLOCKS until findings are ready — do not poll. Use get_findings only
> to read an already-finished run."

---

## 5. Testing plan (vitest; `.it.test.ts` = non-hermetic, excluded from default)

- `shape.test.ts` — pure: field whitelist, severity sort, truncation, totals.
- `api-client.test.ts` — `vi.stubGlobal('fetch')`: path/verb/body, envelope→ApiError,
  network-down message.
- `run-agent-on-pr.test.ts` — mock client + SSE: happy / SSE-fallback / failed /
  timeout (fake timers) / progress notifications.
- `get-findings.test.ts` — run_id filter / latest / no_review.
- `list-pulls.test.ts`, `get-conventions.test.ts`, `get-blast-radius.test.ts`.
- `*.it.test.ts` (opt-in) — `InMemoryTransport` pair driving `list_agents` +
  real `run_agent_on_pr` against a running `:3001` + seeded DB.
- `vitest.config.ts` mirror siblings; node env.

---

## 6. Build / run / host config

- Dev: `pnpm install` in `mcp-server/`, then `pnpm dev` (tsx, stdio).
- `pnpm typecheck` / `pnpm build` (→dist) / `pnpm start` (node dist).
- Runtime prereq: API on :3001 with migrated+seeded DB
  (`server/`: `pnpm db:migrate && pnpm db:seed && pnpm dev`).
- Host config (Claude Desktop / Code):
  ```jsonc
  { "mcpServers": { "devdigest": {
    "command": "node",
    "args": ["<abs>/dev-digest/mcp-server/dist/index.js"],
    "env": { "DEVDIGEST_API_BASE_URL": "http://localhost:3001",
             "DEVDIGEST_RUN_TIMEOUT_MS": "180000" }
  }}}
  ```
  Dev variant: `command: tsx`, args to `src/index.ts`. Document `claude mcp add` too.

---

## 7. Phases

- **Phase 0 — Scaffold:** package.json, tsconfig, config, stderr logging, index.ts
  (McpServer + StdioServerTransport + instructions), empty registry. Verify host
  connects.
- **Phase 1 — Read tools:** api-client (`listAgents`, `listPulls`, `reviewsForPull`,
  `listRuns`), shape, errors → `list_agents`, `list_pulls`, `get_findings`. Verify
  `repo_id` source for list_pulls.
- **Phase 2 — Write tool:** `sse.ts`, `startReview`, `run_agent_on_pr` with
  SSE-then-poll wait + timeout + progress. TDD with mocked client/SSE + fake timers.
- **Phase 3 — Conventions (real) + blast stub:**
  - server: add `GET /conventions` module (routes/service/repo + register).
  - mcp: `getConventions` client + `get_conventions` tool.
  - `get_blast_radius` static stub.

---

## 8. Risks / prerequisites

1. **`repo_id` source for `list_pulls`** — verify `GET /repos` exists (or a
   workspace-wide pulls endpoint). Flag during Phase 1.
2. **No `GET /runs/:id`** — both findings tools need `pr_id`. Optional future
   server endpoint would drop that requirement.
3. **SSE has no terminal status** — re-query `GET /pulls/:id/runs` after close.
4. **stdout discipline** — any `console.log` corrupts the stream; stderr-only;
   grep `src/` for `console.log`.
5. **Workspace inert** — `DEVDIGEST_WORKSPACE_ID` not used by the API yet; document.
   Missing seeded default workspace → API 500s → surface "run `pnpm db:seed`".
6. **Secrets** — none in the MCP server; LLM keys stay server-side
   (`LocalSecretsProvider`).
7. **Zod lockstep** — pin `zod@^3.24.1` to match server/reviewer-core.
8. **Background run after timeout** — left running by design; hint tells the model
   to call `get_findings` later.
9. **New `GET /conventions` route** — server-side change; follow server conventions
   (schema-first Zod, plugin registration, `.it.test.ts` for DB tests).
