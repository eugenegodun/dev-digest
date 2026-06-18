# Insights — `@devdigest/web`

A running log of gotchas and non-obvious decisions that don't earn a line in
[CLAUDE.md](./CLAUDE.md). **Append-only** — never overwrite; correct with a dated
note. Promote recurring/critical entries up into CLAUDE.md's **Gotchas** (line test:
"if I remove this, will Claude start making mistakes?").

Sections are fixed; append under the matching one. Capture via the
`engineering-insights` skill. Entry format — cold-actionable, with evidence:
`- **YYYY-MM-DD** — what to do/avoid and why (evidence: path/file.ts:line)`

## What Works

## What Doesn't Work

## Codebase Patterns

- **2026-06-18** — Shared run formatting (`formatCost`, `formatTokens`) lives in
  `src/lib/format-cost.ts`; `RunTraceDrawer/helpers.ts` **re-exports** `formatTokens`
  from there rather than defining its own — keep one source so the trace stat card and
  the `RunCostBadge` stay consistent (evidence: src/lib/format-cost.ts,
  src/components/RunCostBadge/RunCostBadge.tsx).
- **2026-06-18** — `FindingsSeverity` (`@/components/FindingsSeverity`) is the shared
  findings counter + click-to-open anchored peek popover, reused by the PR-list FINDINGS
  column (`PRRow`) and the detail-timeline run rows (`RunHistory`). Counts come from
  `PrMeta.findings` (latest review, server-computed); the popover BODY loads lazily. On
  the list, `PRRow` only enables `usePrReviews(open ? pr.id : null)` once the popover
  opens (via `onOpenChange`), then lists `reviews.find(r => r.kind==='review')?.findings`
  — the `kind==='review'` filter is mandatory so the listed findings match the count
  (reviews include `'summary'` kind, newest-first). The popover deliberately does NOT
  reuse `FindingCard` (that has accept/dismiss); `FindingPeekItem` is read-only
  (evidence: src/components/FindingsSeverity/, src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx).
- **2026-06-18** — `RunCostBadge` (`@/components/RunCostBadge`) has two views: `compact`
  ("$0.014") for the PR-list cost column + review-run header, `detailed`
  ("$0.014 · 8k→1.3k") for the timeline + verdict plate. Null/no-data cost renders "—",
  never "$0.00".

## Tool & Library Notes

## Recurring Errors & Fixes

- **2026-06-18** — `RunStats.cost_usd` / `RunSummary.cost_usd` are `z.number().nullable()`
  — a **required key with a nullable value**, not optional. Every hand-built `RunSummary`
  / `RunStats` test fixture must include `cost_usd` (e.g. `cost_usd: null`) or `tsc` fails
  with "Two different types with this name exist" (evidence:
  RunHistory.test.tsx:17, RunTraceDrawer.test.tsx:10).

## Session Notes

## Open Questions
