# PR Self-Review — references

## Finding schema

Each reviewer returns one JSON object — the list of files it reviewed plus its findings,
nothing else:

```json
{
  "reviewedFiles": ["server/src/routes/reviews.ts"],
  "findings": [
    {
      "file": "server/src/routes/reviews.ts",
      "line": 12,
      "severity": "critical",
      "skill": "security",
      "issue": "User-controlled `id` interpolated into sql.raw — SQL injection.",
      "fix": "Use a parameterized query: sql`... WHERE id = ${id}`."
    }
  ]
}
```

`reviewedFiles` MUST list every file the reviewer was assigned (so the orchestrator can
reconcile reviewed + excluded == total). Empty `findings` means the bucket is clean.

- `severity` ∈ `critical` | `major` | `minor` (no other values).
- `skill` is the routed skill that justifies the finding (traceability — so the verdict
  shows *which* skill flagged each issue).
- One object per issue. Empty array `[]` means the bucket is clean.

## Dispatch prompt template (one per non-empty bucket)

Fill in `{BUCKET}`, `{SKILLS}`, and `{FILES_WITH_DIFFS}` and dispatch in parallel.

> You are the **{BUCKET}** reviewer for a pre-PR self-review in the `dev-digest` repo.
>
> **First, load these skills via the Skill tool and apply them — do not review from
> general knowledge:** {SKILLS}.
>
> Review EVERY one of these changed files against their diffs (do not spot-check —
> every file in this list must be examined):
> {FILES_WITH_DIFFS}
>
> Report problems the loaded skills would catch: architecture/layering violations,
> framework misuse, security holes, type/contract regressions, test anti-patterns.
>
> **Rules:**
> - Do NOT edit files or apply fixes. Review only.
> - Severity is exactly `critical` | `major` | `minor` (see severity table in SKILL.md).
> - Output ONLY the JSON object from the schema (`reviewedFiles` + `findings`).
>   `reviewedFiles` must echo back every file you were assigned. No prose, no preamble.

## Routing buckets (derived from README `Scope` column)

| Skill | Scope | Bucket |
|---|---|---|
| onion-architecture | Backend | Backend / domain |
| fastify-best-practices | Backend | Backend / domain |
| drizzle-orm-patterns | Backend | Backend / domain |
| postgresql-table-design | Backend | Backend / domain |
| frontend-architecture | Frontend | Frontend / UI |
| next-best-practices | Frontend | Frontend / UI |
| react-best-practices | Frontend | Frontend / UI |
| react-testing-library | Frontend | Frontend / UI (test files only) |
| zod | Full-stack | Both buckets |
| typescript-expert | Full-stack | Both buckets |
| security | Full-stack | Both buckets |
| mermaid-diagram | Shared | Excluded (not a reviewer) |
| engineering-insights | Shared | Excluded (not a reviewer) |

When a new skill is added to the catalog, it joins routing automatically by its `Scope`:
`Backend` → backend bucket, `Frontend` → frontend bucket, `Full-stack` → both,
`Shared` → excluded.

## Why advisory, not hard-block

The PreToolUse hook (`.claude/settings.json`) that auto-launches this before
`gh pr create` / `git push` returns a **non-blocking reminder**, not exit code 2.
A `REJECTED` verdict is a loud recommendation to fix first — the developer stays in
control of whether to proceed.
