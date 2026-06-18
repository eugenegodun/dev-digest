# CLAUDE.md — `@devdigest/e2e`

Browser end-to-end suite. Canonical overview: [README.md](./README.md). This
file is a **map, not documentation** — non-obvious facts only; docs are linked.

## Stack

- Vercel **agent-browser** (native Rust + CDP CLI). **No Playwright, no LLM, no
  API key.** A spec is a JSON list of agent-browser commands run by `run.ts`.

## Commands

- Hermetic (recommended): `./scripts/e2e.sh` — isolated freshly-seeded stack on
  alternate ports (PG `:5433`, API `:3101`, web `:3100`), torn down after.
- Against your own stack: `cd e2e && npm install && npm test` (only safe if your
  dev DB has *only* the seeded repo — see README precondition).
- One-time: `npm i -g agent-browser && agent-browser install`.

## Where things live

- `specs/NN-name.flow.json` — flow specs (and any written `.md` specs); see [specs/](./specs).
- `run.ts` — runs a flow's `cmd` list verbatim against one shared session.
- `test-results/` — failure screenshots (git-ignored).

## Non-default conventions

- `wait --text` / `wait --url` **are the assertions** — a non-zero exit fails the step.
- Deterministic locators only (`--url`, `--text`, `find role|text|label`); never the AI `chat` command.
- `{BASE}` → `E2E_BASE_URL` (default `http://localhost:3000`).
- Flows target **read-only seeded data** (`acme/payments-api`, PR #482) so nothing calls a model.

## Gotchas

- **Flows 02/04/05 assume the seeded demo repo is the only one** (they follow the
  home redirect to the first repo). Run the **hermetic** runner — running `npm test`
  against a dev DB with other repos makes them land on the wrong repo and fail.
- ⚠️ **Never `docker compose down -v` to "reset" your dev DB** — `-v` deletes the
  `devdigest_pgdata` volume and every imported repo/review.

## More (loaded only when relevant)

- [docs/](./docs) · [specs/](./specs) · [INSIGHTS.md](./INSIGHTS.md)
- Session protocol: read [INSIGHTS.md](./INSIGHTS.md) before work here; capture
  substantial learnings at session end via the `engineering-insights` skill.
