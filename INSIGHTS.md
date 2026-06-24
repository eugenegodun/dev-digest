# Insights — dev-digest (cross-cutting)

Repo-wide learnings that don't belong to a single package — tooling, `scripts/`,
CI, boot/dev flow, or anything spanning ≥2 packages. Package-scoped insights live
in that package's `INSIGHTS.md` ([client](./client/INSIGHTS.md) ·
[server](./server/INSIGHTS.md) · [reviewer-core](./reviewer-core/INSIGHTS.md) ·
[e2e](./e2e/INSIGHTS.md)).

**Append-only** — never overwrite; correct with a dated note. Promote
recurring/critical entries up into the root [CLAUDE.md](./CLAUDE.md). Sections are
fixed; append under the matching one. Capture via the `engineering-insights` skill.
Entry format — cold-actionable, with evidence:
`- **YYYY-MM-DD** — what to do/avoid and why (evidence: path/file.ts:line)`

## What Works

## What Doesn't Work

- **2026-06-23** — Parallel `implementer` subagents share **one working tree** (no worktree
  isolation). An agent that runs `git stash` sweeps up *sibling agents'* concurrent
  uncommitted changes, and a follow-up `git stash drop` destroys them irreversibly. When
  dispatching implementers concurrently: (1) scope each strictly to non-overlapping files,
  and (2) explicitly forbid `git stash`/`git stash drop` in the prompt. Also expect transient
  `typecheck`/`test` failures if one agent reads a shared file mid-edit by another — re-run
  the check once the wave settles before trusting a failure (evidence: this session — a Task 1
  implementer triggered an irreversible-local-destruction warning via stash drop; no data was
  lost because the tree had no pre-existing tracked changes).

## Codebase Patterns

- **2026-06-18** — `@devdigest/shared` Zod contracts are **vendored into BOTH
  `client/src/vendor/shared` and `server/src/vendor/shared` with no in-repo source** —
  the alias just points each package at its own copy. A contract change must edit
  **both copies identically** (e.g. adding `cost_usd` to `RunSummary`/`RunStats`/
  `PrMeta`/`ReviewRecord`). CLAUDE.md's "edit at source, do not touch vendor" is
  aspirational here — there is no source; commit `d45ab0d` edited both vendor copies
  directly, and that's the working convention (evidence: both `*/src/vendor/shared/contracts/trace.ts`).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
