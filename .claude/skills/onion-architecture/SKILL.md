---
name: onion-architecture
description: "Onion Architecture for dev-digest backend modules (server/ and reviewer-core/). Use when adding or restructuring a backend module — creating routes/services/repositories, deciding WHERE database queries, LLM/GitHub/git calls, and business logic go, adding a new adapter, or reviewing whether a change leaks Drizzle, Fastify, an SDK, or Zod DTOs into a layer that shouldn't have them. Complements fastify-best-practices (HTTP mechanics) and drizzle-orm-patterns (query mechanics). Trigger terms: where does this query go, route vs service vs repository, layering, dependency rule, leak Drizzle into the route, keep reviewer-core pure, adapter, onion, hexagonal, clean architecture."
metadata:
  tags: architecture, onion, hexagonal, clean-architecture, backend, layering, dependency-rule, fastify, drizzle, reviewer-core
---

# Onion Architecture (backend)

Dev-digest's backend is layered as concentric rings. **Source-code dependencies
point inward only.** The domain core knows nothing about HTTP, the database, or
any external SDK; those live at the edge and are reached through interfaces wired
in the composition root (`server/src/platform/container.ts`).

This skill answers *placement* questions: where does a query / an LLM call / a
piece of business logic go, and what a layer is forbidden to import. For HTTP
mechanics use `fastify-best-practices`; for query mechanics use `drizzle-orm-patterns`.

For good/bad placement examples see [examples.md](examples.md). For the canonical
articles (Palermo, Cockburn, Martin) and TypeScript guidance see [references.md](references.md).
A ready-to-run dependency-cruiser ruleset is in [dependency-cruiser.cjs](dependency-cruiser.cjs).

## Severity Levels

- **CRITICAL** — breaks the dependency rule (an outer concern leaks inward). Spreads by copy-paste.
- **HIGH** — wrong layer for the responsibility; scales into scattered, untestable code.
- **MEDIUM** — hurts consistency or testability without breaking the rule.

---

## The rings → our folders

Outer rings depend on inner rings, never the reverse.

| Ring | Lives in | Owns | MUST NOT import |
|------|----------|------|-----------------|
| **Presentation** | `server/src/modules/*/routes.ts` | Fastify route, Zod in/out validation, auth/workspace context. Delegates to a service. | `drizzle-orm`, `../../db/*`, `openai`, `@anthropic-ai/sdk`, `octokit`, `simple-git` |
| **Application (use case)** | `server/src/modules/*/service.ts`, executors | Orchestrates ONE feature; composes repositories + adapters from `container`. | `drizzle-orm`/`postgres` (query builder), external SDKs directly |
| **Infrastructure** | `server/src/modules/*/repository.ts`, `server/src/db/*`, `server/src/adapters/*` | The ONLY place Drizzle queries and external SDK calls live. Implements the interfaces in `vendor/shared/adapters.ts`. | — (this is the edge) |
| **Domain core** | `reviewer-core/src` | Pure review logic. Side-effect-free except the injected `LLMProvider`. | `fastify`, `drizzle-orm`, `postgres`, `octokit`, `simple-git`, SDK clients, DB row types |

**The dependency rule, stated as imports:** `routes.ts` → `service.ts` →
`repository.ts` / adapter **interface**. Repositories and adapters are the edge.
`reviewer-core` sits at the center and imports nothing outward — it receives
already-resolved data (e.g. author handles) as plain input.

---

## The non-negotiable rule

**A database query or external SDK call NEVER lives in a route handler or a
service body.** Drizzle queries live in a `repository.ts`. LLM/GitHub/git calls
go through an adapter resolved from `container`. A route delegates to a service;
a service composes repositories and adapters.

**Violating the letter of this rule is violating its spirit.** "I'll put the
query in the route just this once" is the precedent the next feature copies.

### Red flags — STOP, you're about to leak a layer

- `container.db.select(...)` / `db.insert(...)` inside a `routes.ts` or a `service.ts`
- `import ... from 'drizzle-orm'` or `from '../../db/schema'` in `routes.ts`
- `new OpenAI(...)`, `import 'octokit'`, `import 'simple-git'` outside `adapters/`
- A `routes.ts` that doesn't call a service
- Any DB / `fs` / network access added to `reviewer-core/src`
- Thinking "this is a thin/quick/read-only feature, it doesn't need the layers"

All of these mean: move the data access to a repository or adapter; have the
route call a service. The service method may be a one-line passthrough — that is
correct, not waste.

### Rationalizations (captured from real baselines)

| Excuse | Reality |
|--------|---------|
| "The thin feature adds one handler and zero new layers." | The layers already exist. Skipping them isn't leaner — it's a leak the next PR copies. The layered version is the same code in the right files. |
| "It's a quick, read-only query — the route can call the repo directly." | Size and direction don't change *where DB access belongs*. Reads go through a service → repository too; the service method can be one line. |
| "Avoid extra layers of indirection / keep it lean." | The indirection is the boundary that keeps Fastify and Drizzle swappable and the logic testable without a DB. Removing it is not a simplification, it's coupling. |
| "Demo is in 30 minutes, I'll refactor later." | "Later" is when it's load-bearing and three features import it. Pressure doesn't move the boundary. |
| "reviewer-core needs author data, so it should query the DB." | reviewer-core is pure by contract. Resolve the data in a server repository and pass it in as plain input. |

---

## Where Zod fits

Zod validates at the **boundary** (route `params`/`body` via
`fastify-type-provider-zod`, env config). The validated DTO flows inward. The
domain core does not import Zod-bound DB row types — it receives plain shapes.
Validate once at the edge, trust inside.

## Adding a new external dependency (LLM, API, CLI tool)

Wrap it in an adapter under `server/src/adapters/<name>/`, expose an **interface**
in `vendor/shared/adapters.ts`, and resolve it from `container.ts`. Services and
routes depend on the interface, never the SDK. This is what keeps providers
swappable and lets tests inject mocks (`adapters/mocks.ts`).

## Enforcing it mechanically

The dependency rule is machine-checkable — we already depend on `dependency-cruiser`,
and it is **wired into CI** (the `onion-architecture` job in `.github/workflows/server-unit.yml`).
Run it locally from `server/`:

```bash
cd server && pnpm lint:arch
```

It fails on any inward leak (Drizzle/SDK in a route, query in a service,
infrastructure imported into `reviewer-core`).

**Pre-existing debt is baselined, not waived.** Four routes (`workspace`,
`settings`, `pulls`, `polling`) already import `drizzle-orm` directly; they're
recorded in `server/.dependency-cruiser-known-violations.json` and ignored via
`--ignore-known` so the gate is green for *new* code while the debt stands. NEW
leaks fail the build. When you fix one of the four, regenerate the baseline so it
shrinks (and can never silently grow):

```bash
cd server && pnpm lint:arch:baseline   # then commit the smaller file
```

Do **not** regenerate the baseline to absorb a new violation — that defeats the gate.

## Common mistakes

- **Repository doing business logic.** Filtering/branching that encodes a rule
  belongs in the service; the repository returns rows. (e.g. "latest review of
  kind X" — repo returns all, service selects.)
- **Service with mixed side effects.** One method that queries, calls an LLM, and
  publishes SSE is doing four jobs. Split: repository reads/writes, adapter calls
  the LLM, service orchestrates, `RunBus` publishes.
- **Anemic domain.** If every "entity" is a bag of fields and all behavior sits in
  services, you've inverted the model. Put invariants with the data.
