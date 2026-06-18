# Insights — `@devdigest/e2e`

A running log of gotchas and non-obvious decisions that don't earn a line in
[CLAUDE.md](./CLAUDE.md). Append dated entries; promote the recurring/critical
ones up into CLAUDE.md's **Gotchas** (one line, must pass the line test:
"if I remove this, will Claude start making mistakes?").

Format:

```
## YYYY-MM-DD — short title
What was surprising, why it matters, and what to do about it.
```

## Seed — running the suite

- The hermetic runner uses an **ephemeral** Postgres (no persistent volume), so
  it's empty every run and the seeded demo repo is the only one — exactly what
  flows 02/04/05 need. This is why it's the recommended path.
- Env knobs: runner — `E2E_BASE_URL`, `AGENT_BROWSER_BIN`, `E2E_STEP_TIMEOUT`
  (ms, default 60000); hermetic stack — `E2E_PG_PORT`/`E2E_API_PORT`/`E2E_WEB_PORT`,
  `E2E_PG_CONTAINER`, `E2E_PG_IMAGE` (`pgvector/pgvector:pg16`).

<!-- Add new entries below. -->
