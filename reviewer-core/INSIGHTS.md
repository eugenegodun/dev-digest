# Insights — `@devdigest/reviewer-core`

A running log of gotchas and non-obvious decisions that don't earn a line in
[CLAUDE.md](./CLAUDE.md). **Append-only** — never overwrite; correct with a dated
note. Promote recurring/critical entries up into CLAUDE.md's **Gotchas** (line test:
"if I remove this, will Claude start making mistakes?").

Sections are fixed; append under the matching one. Capture via the
`engineering-insights` skill. Entry format — cold-actionable, with evidence:
`- **YYYY-MM-DD** — what to do/avoid and why (evidence: path/file.ts:line)`

## What Works

## What Doesn't Work

## Codebase Patterns

- The package is **pure** by design: the only side effect is the injected
  `LLMProvider` call. Don't add DB/GitHub/filesystem access here — it lives in
  the server. Purity is what keeps the engine mock-testable with no keys.
- `build` is a type-check; the package never emits JS. The server consumes the
  TS source directly (tsx in dev, vitest in tests).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
