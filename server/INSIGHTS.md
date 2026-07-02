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
- **2026-06-18** — `reviewsForPull(db, prId)` returns **every** review kind (both
  `'summary'` and `'review'`), newest-first — it does NOT filter to `kind='review'`.
  So "the latest review" is `reviews.find(r => r.kind === 'review')`, not `reviews[0]`
  (a stray summary can sit at index 0). The PR-list score/findings aggregate filters
  `kind='review'` in SQL; any consumer pairing with it (e.g. the client findings peek)
  must filter the same way or the counts won't match (evidence:
  src/modules/reviews/repository/review.repo.ts:58, src/modules/pulls/routes.ts).
- **2026-06-18** — `estimateCost(model, …)` matches the PRICING slug **exactly**, so a
  provider-prefixed model string like `openrouter/deepseek-v4-flash` misses the key
  `deepseek/deepseek-v4-flash` and returns `null` → the cost badge shows "—". If many
  runs render "—", reconcile slugs in `pricing.ts`, don't assume the cost code is broken
  (evidence: src/adapters/llm/pricing.ts:37).

## Codebase Patterns

- **2026-06-24** — A deterministic compose endpoint (e.g. `GET /pulls/:id/smart-diff`) must
  read PR files + reviews through the **`ReviewRepository` facade**
  (`container.reviewRepo.getPrFiles(prId)` / `.reviewsForPull(prId)`), NOT by importing the
  underlying `modules/reviews/repository/*.repo.js` free functions directly. The facade is the
  single DB seam for the review domain; importing internals couples the consumer to the reviews
  module's file layout (caught in architecture review — the first cut imported the free
  functions). The `smart-diff` module also deliberately OMITS the `brief` module's
  LLM/cache/`head_sha` machinery: it is pure compute-on-read (no LLM, no cache table, no
  migration), classifies files via patterns in `constants.ts` (precedence boilerplate → wiring →
  core), and ends in `SmartDiff.parse()` (evidence: src/modules/smart-diff/service.ts
  buildSmartDiff).
- **2026-06-23** — The `brief` module (PR Brief / Intent Layer) derives intent with its
  **own minimal trusted system prompt + `wrapUntrusted` from reviewer-core**, NOT through
  `assemblePrompt`/`reviewPullRequest`. That path is review/grounding-shaped (Review schema,
  findings, citation gate) and would couple the cheap intent pass to a review run. Intent
  returns the `Intent` schema and has no grounding gate — fencing untrusted inputs
  (PR title/body, linked-issue body, spec chunks, diff) is the *sole* injection defense here
  (evidence: src/modules/brief/intent.ts).
- **2026-06-24** — The `brief` service composes its four sections (`intent`, `blast`,
  `risks`, `history`) with **`Promise.allSettled` + per-section empty-but-valid fallback** —
  `intent` is the only must-have; any other section's failure (LLM error, **unindexed repo →
  empty `blast`**, missing merged-PR data → empty `history`, no `risk_brief` key → empty
  `risks`) degrades that section, never the whole brief. `risk_brief` defaults to
  `openai/gpt-4.1`, so on a workspace with no OpenAI key the Risks section silently empties —
  that's expected, not a bug. Verified live: an unsynced repo renders the Blast Radius card in
  its `0 symbols / no downstream` state (evidence: src/modules/brief/service.ts getOrBuildBrief).
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
- **2026-06-18** — Severity tallies have a tested pure helper: `rollupSeverities(rows)`
  in `modules/pulls/status.ts` → `{ critical, warning, suggestion }` (**lowercase** keys),
  ignoring any unknown severity. Reuse it instead of inlining a `for` loop; the PR-list
  `PrMeta.findings` aggregate maps its lowercase keys → the contract's UPPERCASE keys
  (evidence: src/modules/pulls/status.ts:23, src/modules/pulls/routes.ts).
- **2026-06-18** — The PR-list `score`, `cost_usd`, and now `findings` are all computed
  on read from the PR's **latest `kind='review'` review only** (newest `createdAt`),
  never summed across runs — so the list matches the detail page. New per-PR list
  aggregates should follow this same "latest review" rule (evidence:
  src/modules/pulls/routes.ts the latestReviewByPr block).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
