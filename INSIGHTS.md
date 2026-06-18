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
