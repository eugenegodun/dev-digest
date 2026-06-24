---
name: pr-self-review
description: "Use when about to open a pull request or push a branch in dev-digest — before running `gh pr create`, `gh pr ...`, or `git push` — or when asked to self-review / pre-review local changes before a PR. Reviews every changed file on the branch by routing it to the team's existing skills (frontend skills on UI files, backend + domain-architecture skills on server/reviewer-core files). Trigger terms: self review, pre-PR review, review my changes, check before opening a PR, before push, pre-flight review."
metadata:
  tags: pr, code-review, self-review, pre-flight, gate, routing, frontend, backend
---

# PR Self-Review

## Overview

Catch issues **locally, before the PR exists**, by reviewing the branch diff with the
team's own skills instead of from memory. Each changed file is routed to the skills
that govern it; routed skills are **loaded and applied**, findings are aggregated, and
a single verdict is emitted. **≥1 critical finding → `REJECTED`.**

**Core principle:** the value is in *applying the skills*, not in a from-memory review.
A reviewer that "just looks at the diff" without loading the routed skills has not done
this review.

## When to use

- About to run `gh pr create` / `gh pr ...` / `git push` (a hook may auto-launch this).
- Asked to "self-review", "pre-review", or "check my changes before a PR".
- **Not** for reviewing someone else's already-open PR (use `/review` / `security-review`).

## Workflow

Do these in order. Do not skip step 3's skill-loading — that is the whole point.

### 1 · Compute the diff (all changes vs `main`)

```bash
BASE=$(git merge-base main HEAD)
{ git diff --name-only "$BASE"           # committed on branch
  git diff --name-only                   # unstaged
  git diff --name-only --cached          # staged
  git ls-files --others --exclude-standard  # new untracked files
} | sort -u
```
Union of committed-on-branch + unstaged + staged + **untracked new files** (a PR that
adds files must still get reviewed). Then **exclude** non-reviewable paths
and **report what you excluded** (never drop files silently):

- `*/src/vendor/*` · `client/messages/**` (translations) · lockfiles & `*.json` config
- `*.md`, `docs/**` · generated migration snapshots

If the included set is empty, say so and stop — there is nothing to review.

### 2 · Route each file to skills

Source of truth is the **`Scope` column of `.claude/skills/README.md`** — re-read it so
newly added skills participate automatically. Buckets:

| Bucket | File matches | Skills to load |
|---|---|---|
| **Frontend / UI** | `client/**`, `*.tsx`, `*.css` | `frontend-architecture`, `react-best-practices`, `next-best-practices`, `react-testing-library` *(test files only)* |
| **Backend / domain** | `server/**`, `reviewer-core/**`, `*.sql` | `onion-architecture`, `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design` |
| **Full-stack** (added to BOTH active buckets) | any reviewed file | `zod`, `typescript-expert`, `security` |

**Never route to** (Scope = Shared / not a reviewer): `mermaid-diagram`,
`engineering-insights`, `pr-self-review`.

### 3 · Dispatch one reviewer per non-empty bucket

Dispatch a bucket reviewer for **every bucket that has ≥1 file** — if any `server/**`,
`reviewer-core/**`, or `*.sql` file is in scope, the backend reviewer is mandatory; same
for frontend. Run them **in parallel** (see `superpowers:dispatching-parallel-agents`).
If a bucket has many files (>~15), split it into several reviewers by subdirectory so no
agent silently drops files. Each reviewer MUST:

1. **Load every skill routed to its bucket** via the Skill tool (frontend skills *or*
   backend skills, **plus** the full-stack skills). Reviewing from general knowledge
   without loading them is a failed review — redo it.
2. Review **every** file in its assigned list — not a spot-check of the interesting ones.
3. Return **structured findings only** — `{file, line, severity, skill, issue, fix}` —
   **plus the exact list of files it reviewed** (`reviewedFiles`), so step 4 can reconcile.
   `severity ∈ critical | major | minor`. **Do not edit files. Do not apply fixes.**

See `references.md` for the exact dispatch prompt and finding schema.

### 4 · Reconcile, aggregate, emit the verdict

**Reconcile first — the step-1 file list is authoritative.** Every in-scope file must be
either reviewed (appears in some reviewer's `reviewedFiles`) or excluded-with-reason. Assert:

```
reviewed_count + excluded_count == total_in_scope
```

If any file is unaccounted for, you dropped it — re-dispatch for the missing files before
emitting a verdict. A diff with dozens of files is exactly when files go missing; count them.

Then de-dupe findings, sort by severity, and apply the gate:

- **`REJECTED`** if `criticalCount ≥ 1`. List critical findings first.
- **`APPROVED`** otherwise (majors/minors listed as advisories).

Enforcement is **advisory**: on `REJECTED`, stop and surface the blockers with a clear
recommendation to fix before the GitHub call — do not force-abort, and do not proceed to
apply fixes unless explicitly asked.

## Severity (be strict and consistent — not ad-hoc)

| Severity | Means | Examples |
|---|---|---|
| **critical** | Exploitable, data-loss, or breaks the build/contract; blocks the PR | SQL injection, XSS (`dangerouslySetInnerHTML` on unsanitized data), secret in code, DB query in a route (onion dependency-rule break), leaking Drizzle/Fastify into `reviewer-core` |
| **major** | Wrong behavior or a clear rule violation, not yet exploitable | `useEffect` missing a dep, `localStorage` feature-gating instead of `useFeatureToggle`, `any` replacing a typed contract, missing Zod validation on input |
| **minor** | Style / maintainability nit | naming, dead variable, small duplication |

## Output format

```
PR Self-Review — <APPROVED | REJECTED>
Files: <n reviewed> · <m excluded>  (excluded: <paths>)
Findings: <c> critical · <maj> major · <min> minor

CRITICAL
- <file>:<line> — <issue>  [skill: <skill>]
  fix: <one line>
MAJOR
- ...
MINOR
- ...
```

## Red flags — STOP, you're doing it wrong

- "I can review this diff directly without loading the skills" → No. Load the routed skills first; that is the review.
- "I'll just fix the issues while I'm here" → This skill reviews and reports. Don't edit files.
- "I'll skip the vendor/translation files quietly" → Report every excluded path; silent drops read as "everything was covered".
- "The DB call in the route is just a lost abstraction" → It's a **critical** onion dependency-rule break, not a style nit.
- "I'll invent High/Medium/Low" → Use exactly critical/major/minor; the gate keys on `critical`.
- "Nothing changed since last review, skip it" → Re-compute the diff; trust the file list, not memory.
- "There are too many files; I'll spot-check the important-looking ones" → No. Every in-scope file is reviewed or excluded-with-reason; reconcile the counts. Split big buckets across reviewers.
- "Only config changed in server/, no backend reviewer needed" → Check the actual list; one `.ts`/`.sql` file in scope makes the backend reviewer mandatory.

## Common mistakes

| Mistake | Fix |
|---|---|
| Reviewing the diff the user pasted instead of computing it | Always run the step-1 commands against the live branch |
| One agent reviews everything from memory | One reviewer per bucket, each loading its routed skills |
| Frontend skills run on backend files (or vice-versa) | Route by path/extension per the step-2 table |
| Verdict buried in prose | Lead with the `APPROVED`/`REJECTED` line and counts |
