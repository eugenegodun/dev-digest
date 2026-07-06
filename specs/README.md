# specs — cross-module specifications

Top-level home for **Spec-Driven Development (SDD)** specs that span **two or more** modules
(`server` / `client` / `reviewer-core`). Single-module specs live in that module's own folder
(`server/specs/`, `client/specs/`, `reviewer-core/specs/`), not here.

A spec describes *what* a feature must do — independent of implementation — and is the source of
truth that plans and tests are checked against. Specs are authored by the `spec-creator` agent
(see [.claude/agents/spec-creator.md](../.claude/agents/spec-creator.md)).

## Where a spec goes (placement table)

| Scope of the feature | Location |
|---|---|
| Touches **one** module | `<module>/specs/YYYY-MM-DD-<slug>.md` (`server` / `client` / `reviewer-core`) |
| Touches **≥ 2** modules | `specs/YYYY-MM-DD-<slug>.md` (this folder) |

> `e2e/specs/` is unrelated — those are `.flow.json` e2e flows, not SDD specs.

## Naming convention

- Filename: `YYYY-MM-DD-<slug>.md` — creation date + **lowercase-hyphen** feature slug, no spaces
  (e.g. `2026-07-06-review-budget-cap.md`). Never camelCase or underscores.
- Spec ID mirrors the filename: `SPEC-YYYY-MM-DD-<slug>` (e.g. `SPEC-2026-07-06-review-budget-cap`).
- Header line: `# Spec: <feature>  |  Spec ID: SPEC-YYYY-MM-DD-<slug>  |  Status: <status>`.

## Status lifecycle

```
draft ──▶ approved ──▶ implemented
```

- **draft** — authored, may still hold `[NEEDS CLARIFICATION]` open questions. `spec-creator` only
  ever writes this status.
- **approved** — open questions resolved, accepted for implementation (human / downstream decision).
- **implemented** — the feature has shipped and matches the spec.

## SDD chain

```
spec-creator ──▶ specs/YYYY-MM-DD-<slug>.md ──▶ implementation-planner ──▶ docs/plans/<slug>.md ──▶ implementer × N
```

The spec is the input to the `implementation-planner`; the plan is the input to the `implementer`s.

## Index

| Spec | Modules | Summary |
|------|---------|---------|
| _(none yet)_ | | Add cross-module `<feature>.md` specs here. |
