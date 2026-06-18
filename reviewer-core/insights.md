# Insights — `@devdigest/reviewer-core`

A running log of gotchas and non-obvious decisions that don't earn a line in
[CLAUDE.md](./CLAUDE.md). Append dated entries; promote the recurring/critical
ones up into CLAUDE.md's **Gotchas** (one line, must pass the line test:
"if I remove this, will Claude start making mistakes?").

Format:

```
## YYYY-MM-DD — short title
What was surprising, why it matters, and what to do about it.
```

## Seed — engine invariants

- The package is **pure** by design: the only side effect is the injected
  `LLMProvider` call. Don't add DB/GitHub/filesystem access here — it lives in
  the server. Purity is what keeps the engine mock-testable with no keys.
- `build` is a type-check; the package never emits JS. The server consumes the
  TS source directly (tsx in dev, vitest in tests).

<!-- Add new entries below. -->
