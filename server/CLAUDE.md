# CLAUDE.md — `@devdigest/api`

The engine. Canonical overview: [README.md](./README.md). This file is a
**map, not documentation** — non-obvious facts only; detailed docs are linked.

## Stack (versions that matter)

- Fastify 5 (`@fastify/helmet` · `@fastify/cors` · `@fastify/rate-limit` ·
  `fastify-sse-v2`) · Drizzle ORM · `postgres` · pgvector.

## Commands

- Run: `pnpm dev` (`:3001`) · DB: `pnpm db:migrate`, `pnpm db:seed` · Typecheck: `pnpm typecheck`.
- Test: `pnpm test` (both suites). Unit only: `pnpm exec vitest run --exclude '**/*.it.test.ts'`.
  Integration only: `pnpm exec vitest run .it.test`.

## Where things live

- `src/modules/<name>/` — feature plugins (routes + service); registered in `src/modules/index.ts`.
- `src/platform/` — `config.ts` (`loadConfig`), `container.ts` (DI).
- `src/adapters/` — ports (llm · github · git · astgrep · secrets); `mocks.ts` for tests.
- `src/modules/repo-intel/` — codebase indexer feeding review context.

## Non-default conventions

- **Schema-first validation:** routes declare Zod `params`/`body` (`fastify-type-provider-zod`);
  invalid input → `422` before the handler. Don't hand-roll `Schema.parse(req.body)`.
- **Plugins register before modules** so encapsulated modules inherit them.
- DB-backed tests **must** use the `*.it.test.ts` suffix (testcontainers Postgres); else hermetic.
- DB schema holds **every** table — unused ones sit empty until a course lesson fills them.

## Gotchas

- **Migrations are NOT applied on boot** — run `pnpm db:migrate` first (pgvector enabled by `0000`).
- Grounding is mandatory; the model's self-reported score is ignored (recomputed from survivors).
- More non-obvious review-context rules → [INSIGHTS.md](./INSIGHTS.md).

## Do not touch

- Secrets only flow through `LocalSecretsProvider` (`src/adapters/secrets/local.ts`) —
  never read keys elsewhere, never commit them. `GITHUB_TOKEN` canonical, `GITHUB_PAT` fallback.
- `src/vendor/shared` (`@devdigest/shared`) — vendored Zod contracts; edit at source.

## More (loaded only when relevant)

- [docs/](./docs) · [specs/](./specs) · [INSIGHTS.md](./INSIGHTS.md)
