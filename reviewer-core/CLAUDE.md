# CLAUDE.md — `@devdigest/reviewer-core`

The review engine. Canonical overview: [README.md](./README.md). This file is a
**map, not documentation** — non-obvious facts only; detailed docs are linked.

## Stack

- Pure TypeScript. **No** database, GitHub, or filesystem. The only side effect
  is an LLM call through an **injected** `LLMProvider` (what makes it mock-testable).

## Commands

- Test: `npm test` (vitest, hermetic, stubbed `LLMProvider` — no keys, no network).
- `npm run typecheck` **is** the build — the package never emits JS.

## Where things live

- `src/index.ts` — public API surface.
- `prompt.ts` — `assemblePrompt` / `wrapUntrusted` (+ `INJECTION_GUARD`).
- `grounding.ts` — `groundFindings` / `groundingSummary`.
- `llm/structured.ts` — `toJsonSchema` / `extractJson` / `parseWithRepair`.
- `review/run.ts` — the `run` orchestrator (single-pass by default) + `reduce`.

## Non-default conventions

- Consumed as **TypeScript source** via tsconfig alias (`@devdigest/reviewer-core`
  → `../reviewer-core/src`); the server is its only starter consumer.
- Contracts (`Review`, `Finding`, `Verdict`, …) come from `@devdigest/shared`.
- Optional prompt slots (`skills`, `memory`, `specs`, `callers`) are course-lesson
  hooks — omitted in the starter; `assemblePrompt` just leaves those sections out.

## Gotchas (do not break)

- **Grounding is the mandatory gate:** a finding that doesn't cite a real line in
  the diff is dropped. The score is recomputed from the **surviving** findings —
  the model's self-reported score is ignored. Never weaken this.
- Untrusted content is fenced (`wrapUntrusted`) and governed by `INJECTION_GUARD`;
  it's data, never instructions.

## More (loaded only when relevant)

- [docs/](./docs) · [specs/](./specs) · [INSIGHTS.md](./INSIGHTS.md)
- Session protocol: read [INSIGHTS.md](./INSIGHTS.md) before work here; capture
  substantial learnings at session end via the `engineering-insights` skill.
