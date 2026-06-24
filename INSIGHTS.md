# Insights — dev-digest (cross-cutting)

Repo-wide learnings that don't belong to a single package — tooling, `scripts/`,
CI, boot/dev flow, or anything spanning ≥2 packages. Package-scoped insights live
in that package's `INSIGHTS.md` ([client](./client/INSIGHTS.md) ·
[server](./server/INSIGHTS.md) · [reviewer-core](./reviewer-core/INSIGHTS.md) ·
[e2e](./e2e/INSIGHTS.md)).

**Append-only** — never overwrite; correct with a dated note. Promote
recurring/critical entries up into the root [CLAUDE.md](./CLAUDE.md). Sections are
fixed; append under the matching one. Capture via the `engineering-insights` skill.
Entry format — cold-actionable, with evidence:
`- **YYYY-MM-DD** — what to do/avoid and why (evidence: path/file.ts:line)`

## What Works

## What Doesn't Work

- **2026-06-22** — When two parallel-worktree agents both register the same module in `server/src/modules/index.ts` (e.g. Phase 2 adds the import, and a worktree agent also touches the file), the merge produces a **duplicate import** that breaks `tsc`. Fix: instruct later agents to check for existing imports before adding, or reserve index.ts edits to a single sequential agent (evidence: commit 96a9ce8, server/src/modules/index.ts).

- **2026-06-21** — A subagent told to "review these N changed files" **silently drops
  files when N is large** (~47-file branch diff) — it spot-checks the interesting-looking
  ones and returns a false clean verdict. The first `pr-self-review` build returned
  APPROVED while missing two planted criticals (SQLi, XSS), and never dispatched the
  backend reviewer though a `server/**.ts` file was in scope. Fix that worked: treat the
  diff file-list as authoritative and **reconcile** — each reviewer echoes back
  `reviewedFiles`, and `reviewed + excluded == total in scope` must hold before emitting
  a verdict; bucket dispatch is mandatory if ≥1 file matches the bucket
  (evidence: `.claude/skills/pr-self-review/SKILL.md` steps 3–4).

## Codebase Patterns

- **2026-06-22** — Adding a **required field to a shared Zod contract** (e.g. `body_tokens: z.number().int()` on `Skill`, `enabled: z.boolean()` on `AgentSkillLink`) silently breaks every hand-built test fixture that constructs that type — `tsc` catches it but the error appears far from the contract change. Pattern: after adding any required contract field, `grep -r "body_tokens\|AgentSkillLink\|Skill = {" client/src server/src` and add the field to all fixture objects (evidence: commit 2b59305, SkillsTab.test.tsx:44).

- **2026-06-22** — Parallel worktree agents merge **cleanly when they own strictly disjoint files**. Phase 3 (prompt) owned `trace.ts` + reviewer-core + run-executor + client TraceBody; Phase 4 (versions/stats) owned `knowledge.ts` + skills module. No conflicts. The safe rule: assign one contract file per worktree agent, never split a single contract file across two parallel agents.

- **2026-06-18** — `@devdigest/shared` Zod contracts are **vendored into BOTH
  `client/src/vendor/shared` and `server/src/vendor/shared` with no in-repo source** —
  the alias just points each package at its own copy. A contract change must edit
  **both copies identically** (e.g. adding `cost_usd` to `RunSummary`/`RunStats`/
  `PrMeta`/`ReviewRecord`). CLAUDE.md's "edit at source, do not touch vendor" is
  aspirational here — there is no source; commit `d45ab0d` edited both vendor copies
  directly, and that's the working convention (evidence: both `*/src/vendor/shared/contracts/trace.ts`).

## Tool & Library Notes

- **2026-06-21** — A Claude Code **PreToolUse Bash hook that greps the whole stdin JSON
  payload gets false positives**: the payload contains the command string, so a `git
  commit -m "...git push..."` or even `grep "git push"` fires a hook meant for real
  pushes. Fix: parse the actual command with `jq -r '.tool_input.command // ""'` and
  anchor the match to a statement boundary — `(^|[;&|(]|\s&&\s|\s\|\|\s)\s*(git\s+push|gh\s+pr\s+create)`
  — so prose/args mentioning the verbs stay quiet while real invocations (incl. `… && git push`)
  fire (evidence: `.claude/hooks/pr-self-review-reminder.sh`).

## Recurring Errors & Fixes

## Session Notes

## Open Questions
