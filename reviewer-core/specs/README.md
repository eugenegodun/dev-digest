# reviewer-core/specs

Behavior specs and contracts for `@devdigest/reviewer-core` — the intended
behavior of the pipeline stages (prompt assembly, grounding gate, structured
parsing, run orchestration), independent of implementation. Linked from
[CLAUDE.md](../CLAUDE.md); loads only when relevant.

A spec describes *what* a stage must guarantee (invariants like "ungrounded
findings are dropped", inputs/outputs, edge cases) — the source of truth the
hermetic unit tests are checked against.

> Note: `specs` is also a course-lesson prompt slot (L05) the engine can be fed.
> That runtime input is separate from the written specs documented here.

| Spec | Summary |
|------|---------|
| _(none yet)_ | Add `<stage>.md` specs here. |
