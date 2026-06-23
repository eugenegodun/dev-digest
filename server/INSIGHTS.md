# Insights — `@devdigest/api`

A running log of gotchas and non-obvious decisions that don't earn a line in
[CLAUDE.md](./CLAUDE.md). **Append-only** — never overwrite; correct with a dated
note. Promote recurring/critical entries up into CLAUDE.md's **Gotchas** (line test:
"if I remove this, will Claude start making mistakes?").

Sections are fixed; append under the matching one. Capture via the
`engineering-insights` skill. Entry format — cold-actionable, with evidence:
`- **YYYY-MM-DD** — what to do/avoid and why (evidence: path/file.ts:line)`

## What Works

## What Doesn't Work

- **2026-06-23** — `pnpm db:generate` can emit the migration `.sql` + `meta/00NN_snapshot.json`
  but **leave `meta/_journal.json` without the new entry**, so `db:migrate` silently skips
  applying it — integration tests then fail with `column "<x>" does not exist` even though
  the migration file exists on disk. After every generate, confirm `_journal.json` lists the
  new `idx`/`tag`; if missing, add it (idx = file number, tag = filename without `.sql`)
  (evidence: src/db/migrations/meta/_journal.json idx 10 `0010_bizarre_callisto`).
- **2026-06-18** — `estimateCost(model, …)` matches the PRICING slug **exactly**, so a
  provider-prefixed model string like `openrouter/deepseek-v4-flash` misses the key
  `deepseek/deepseek-v4-flash` and returns `null` → the cost badge shows "—". If many
  runs render "—", reconcile slugs in `pricing.ts`, don't assume the cost code is broken
  (evidence: src/adapters/llm/pricing.ts:37).

## Codebase Patterns

- **2026-06-23** — The `brief` module (PR Brief / Intent Layer) derives intent with its
  **own minimal trusted system prompt + `wrapUntrusted` from reviewer-core**, NOT through
  `assemblePrompt`/`reviewPullRequest`. That path is review/grounding-shaped (Review schema,
  findings, citation gate) and would couple the cheap intent pass to a review run. Intent
  returns the `Intent` schema and has no grounding gate — fencing untrusted inputs
  (PR title/body, linked-issue body, spec chunks, diff) is the *sole* injection defense here
  (evidence: src/modules/brief/intent.ts).
- **2026-06-23** — `pr_brief` is a single-blob cache (`pr_id` PK, `json` jsonb) with a
  `head_sha` column added for invalidation: read-compare `cached.headSha === pull.headSha`,
  rebuild on mismatch (no SSE — plain `GET /pulls/:id/brief`). The shared `PrBrief` schema
  requires all four sections, so a phase that fills only `intent` must persist
  **empty-but-valid** siblings — `blast:{changed_symbols:[],downstream:[],summary:''}`,
  `risks:{risks:[]}`, `history:{history:[]}` — so `PrBrief.parse` passes. Never loosen the
  vendored shared schema to allow partials (evidence: src/modules/brief/service.ts).
- **2026-06-18** — Run **cost is computed on read, never persisted** (`runCost` →
  `estimateCost` = tokens × price). `agent_runs` stores `tokens_in/out` + `model` only;
  commit `d45ab0d` deliberately dropped the `cost_usd` column. To surface cost, add it
  in the serializers (`run.repo.ts listRunsForPull`, `service.getRunTrace`,
  `reviewsForPull`, `pulls/routes.ts` PR-list aggregate) — **no migration**. This keeps
  cost correct when the pricing table changes and for rows seeded before the badge
  existed (evidence: src/adapters/llm/pricing.ts:43, src/modules/reviews/service.ts getRunTrace).
- **2026-06-18** — `runCost(model, tokensIn, tokensOut)` returns `null` (→ UI "—") for
  no model / no token usage / unpriced model, but **0 for a genuinely free model**
  (e.g. `z-ai/glm-4.7-flash`, priced at 0). "No data" and "free" are distinct on purpose
  (evidence: src/adapters/llm/pricing.ts:48).

- **Repo Intel is ON by default** (`REPO_INTEL_ENABLED=true`); a per-agent
  `repo_intel` toggle gates enrichment. Repo-map sections only populate once the
  repo is **indexed** — an unindexed repo degrades silently to diff-only.
- **Prompt-injection defense is one shared trusted rule, not text parsing.**
  `INJECTION_GUARD` (appended by `assemblePrompt`) tells the model untrusted
  content is data, never instructions; claims of "intentional / demo / test /
  do not flag" never descope the review. We deliberately do not keyword-scan.
- **Rate limiting:** global 120/min (disabled under `NODE_ENV=test`), tighter
  per-route caps on expensive endpoints; SSE and `/health*` are exempt.
- The engine reaps orphaned `running` runs on boot.

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
