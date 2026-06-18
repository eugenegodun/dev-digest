# CLAUDE.md — DevDigest

Local-first AI pull-request review. Canonical overview: [README.md](./README.md).
This file is a **map, not documentation** — non-obvious, repo-wide facts only.
Each package has its own `CLAUDE.md` that loads when you work in that folder.

## Packages

Standalone packages — **no monorepo workspace**; each has its own `package.json`
and lockfile. Cross-package code is shared via tsconfig path aliases, not
published modules.

| Folder           | Package                    | What                                  | Port |
|------------------|----------------------------|---------------------------------------|------|
| `server/`        | `@devdigest/api`           | Fastify API + Drizzle/Postgres        | 3001 |
| `client/`        | `@devdigest/web`           | Next.js 15 web app (the studio)       | 3000 |
| `reviewer-core/` | `@devdigest/reviewer-core` | Pure review engine (diff → findings)  | —    |
| `e2e/`           | `@devdigest/e2e`           | Browser e2e (agent-browser)           | —    |
| `*/src/vendor/shared` | `@devdigest/shared`   | Zod contracts, vendored into each pkg | —    |

## Commands

- Boot everything from zero: `./scripts/dev.sh` (Postgres + API + web, seeded).
- Per package: `pnpm dev` / `pnpm test` / `pnpm typecheck` in that folder.
- Prereqs: Node ≥ 22 · pnpm ≥ 10 · Docker (Postgres only).

## Non-default conventions

- **Migrations are NOT applied on boot** — run `cd server && pnpm db:migrate`.
- Only **Postgres** runs in Docker; API and web run on the host.
- Secrets live in `~/.devdigest/secrets.json` (mode `0600`) — never in git or the DB.

## Do not touch

- `*/src/vendor/*` — vendored code (`@devdigest/ui`, `@devdigest/shared`); edit at source.
- `client/messages/<locale>/*.json` — translation files; don't edit directly.
- Never `docker compose down -v` to "reset" — `-v` deletes the `devdigest_pgdata`
  volume and every imported repo/review. Use the hermetic e2e runner instead.

## Engineering insights (session protocol)

Each module keeps an append-only `INSIGHTS.md` of non-obvious learnings, plus a
root [INSIGHTS.md](./INSIGHTS.md) for cross-cutting ones. The loop:

- **At session start:** before working in a module, read that module's
  `INSIGHTS.md` and confirm you've read it by summarizing the points relevant to
  today's task. Treat them as high-confidence guidance unless told otherwise.
- **At session end:** run the `engineering-insights` skill to capture substantial,
  non-duplicate learnings into the touched module's `INSIGHTS.md`. Only append, or
  correct with a dated note — never overwrite. If nothing substantial is new, write
  nothing. Do not skip this step.

## More (loaded only when relevant)

- Package maps: [server](./server/CLAUDE.md) · [client](./client/CLAUDE.md) ·
  [reviewer-core](./reviewer-core/CLAUDE.md) · [e2e](./e2e/CLAUDE.md)
- [TESTING.md](./TESTING.md) — full test strategy & CI
- [docs/](./docs) — agent prompts and deeper docs · [INSIGHTS.md](./INSIGHTS.md) — cross-cutting learnings
