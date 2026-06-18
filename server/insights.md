# Insights — `@devdigest/api`

A running log of gotchas and non-obvious decisions that don't earn a line in
[CLAUDE.md](./CLAUDE.md). Append dated entries; promote the recurring/critical
ones up into CLAUDE.md's **Gotchas** (one line, must pass the line test:
"if I remove this, will Claude start making mistakes?").

Format:

```
## YYYY-MM-DD — short title
What was surprising, why it matters, and what to do about it.
```

## Seed — review context (non-obvious)

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

<!-- Add new entries below. -->
