# Insights — `@devdigest/e2e`

A running log of gotchas and non-obvious decisions that don't earn a line in
[CLAUDE.md](./CLAUDE.md). **Append-only** — never overwrite; correct with a dated
note. Promote recurring/critical entries up into CLAUDE.md's **Gotchas** (line test:
"if I remove this, will Claude start making mistakes?").

Sections are fixed; append under the matching one. Capture via the
`engineering-insights` skill. Entry format — cold-actionable, with evidence:
`- **YYYY-MM-DD** — what to do/avoid and why (evidence: path/file.ts:line)`

## What Works

- The hermetic runner uses an **ephemeral** Postgres (no persistent volume), so
  it's empty every run and the seeded demo repo is the only one — exactly what
  flows 02/04/05 need. This is why it's the recommended path.

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

- Env knobs: runner — `E2E_BASE_URL`, `AGENT_BROWSER_BIN`, `E2E_STEP_TIMEOUT`
  (ms, default 60000); hermetic stack — `E2E_PG_PORT`/`E2E_API_PORT`/`E2E_WEB_PORT`,
  `E2E_PG_CONTAINER`, `E2E_PG_IMAGE` (`pgvector/pgvector:pg16`).

## Recurring Errors & Fixes

## Session Notes

## Open Questions
