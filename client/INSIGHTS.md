# Insights — `@devdigest/web`

A running log of gotchas and non-obvious decisions that don't earn a line in
[CLAUDE.md](./CLAUDE.md). **Append-only** — never overwrite; correct with a dated
note. Promote recurring/critical entries up into CLAUDE.md's **Gotchas** (line test:
"if I remove this, will Claude start making mistakes?").

Sections are fixed; append under the matching one. Capture via the
`engineering-insights` skill. Entry format — cold-actionable, with evidence:
`- **YYYY-MM-DD** — what to do/avoid and why (evidence: path/file.ts:line)`

## What Works

- **2026-06-24** — `useFeatureToggle` did not exist in the codebase when Smart Diff was implemented. The CLAUDE.md convention "feature gating uses `useFeatureToggle`, not localStorage" implied it should be created as a thin env-var hook (`NEXT_PUBLIC_FEATURE_<NAME>` → enabled unless `"0"`). Default-on (opt-out) was chosen so new features ship enabled. Created at `src/lib/hooks/feature-toggles.ts`. (evidence: client/src/lib/hooks/feature-toggles.ts)
- **2026-06-24 (correction to the note above)** — Feature-toggle gating is **NOT wanted in dev-digest** — that convention came from a different project and was removed from the user's global instructions. The env-var hook was deleted (`src/lib/hooks/feature-toggles.ts` left as an inert `export {}` stub pending file deletion) and Smart Diff ships **always-on** with no flag (a plain `useState` Smart/Original toggle, no gate). Do NOT reintroduce `useFeatureToggle`/`NEXT_PUBLIC_FEATURE_*` here; new user-facing surfaces are unconditional (evidence: client/src/app/repos/[repoId]/pulls/[number]/_components/DiffTab/DiffTab.tsx).

## What Doesn't Work

- **2026-06-24** — `@testing-library/user-event` is **not installed** in the client package (only `@testing-library/react` and `@testing-library/jest-dom` are present). Tests that need click interactions must use `fireEvent.click()` from `@testing-library/react`, not `userEvent`. Attempting to import `user-event` causes a Vite import-analysis error at test-collect time, failing the whole suite silently. (evidence: client/node_modules/@testing-library — only `jest-dom` and `react` dirs exist)

- **2026-06-24** — `Icon.FolderOpen` does not exist in the vendored icon registry. The icons.tsx only exports `Folder`. Using an unregistered name (`Icon.FolderOpen`) fails at runtime with "element type is invalid: got undefined" — the error appears in `SplitBanner`'s render, not at the call site. Always verify icon names against `client/src/vendor/ui/icons.tsx` before using them. (evidence: client/src/vendor/ui/icons.tsx)

## Codebase Patterns

- **2026-06-24** — `FileCard` (diff-viewer) manages its own open/close state via internal `useState` and does NOT expose an external control prop. Components that need programmatic expand (e.g. "click badge → expand and scroll") must build their own file-card rather than trying to wrap `FileCard`. The plan says "reuse FileCard" — in practice this means reusing `parsePatch` and following the FileCard visual idiom, not importing the component itself when external control is needed. (evidence: client/src/components/diff-viewer/FileCard/FileCard.tsx:36)

- **2026-06-24** — Group headers and file headers in SmartDiffView both render with `role="button"`. When testing badge clicks with `getByRole("button")`, always use a disambiguating `name` option (e.g. `{ name: /click to expand and jump to first/i }`) or `getAllByRole` will match both the file header and the badge. (evidence: SmartDiffView.test.tsx)

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
