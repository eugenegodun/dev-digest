---
name: sdd
description: >
  Runs the DevDigest Spec-Driven Development **execution** phase from an approved Implementation
  Plan: implement (parallel or sequential per plan mode) → architecture-review → fix-loop →
  plan-verify → report. Use when the user runs `/sdd <plan>` or asks to "run SDD", "implement the
  plan", "execute the plan with review + verify", or "take this plan through implementation". It does
  NOT create specs or plans — spec-creator and implementation-planner are run manually beforehand.
  Cost-optimized: implementer/architecture-reviewer/plan-verifier all run on **Sonnet** (per-dispatch
  override) and **test-writer is not invoked**. Leaves changes uncommitted for the human to commit.
---

# /sdd — Spec-Driven Development runner (execution phase)

You orchestrate the **execution** half of DevDigest's SDD pipeline. The upstream stages
(`spec-creator` → `implementation-planner`) are run **manually** by the human before this command.
Your input is an **approved Implementation Plan** at `docs/plans/<slug>.md`. You never author specs
or plans here.

Pipeline you drive: **implement → architecture-review → fix-loop → plan-verify → report.**

## Arguments

```
/sdd <plan-path> [--spec <path>] [--designs <links>] [--req "extra requirements"]
```

- `<plan-path>` (**required**) — the plan, e.g. `docs/plans/review-budget-cap.md`. If omitted or the
  file is missing, stop and ask for it. Do not guess a plan.
- `--spec <path>` (optional) — the source spec (`*/specs/<feature>.md`). Forward it to implementers
  and the verifier as grounding context.
- `--designs <links>` (optional) — design references (Figma links, paths). Forward to implementers.
- `--req "…"` (optional) — extra requirements/constraints to layer on top of the plan.

If the user names a feature but no plan path, `Glob docs/plans/*<slug>*.md` to locate it; if
ambiguous, ask.

## Cost mode (locked for this command)

- **All dispatched agents run on Sonnet** via the Agent tool `model: "sonnet"` param — a
  per-dispatch override. Do NOT edit the agents' frontmatter; they stay Opus-capable when run
  standalone elsewhere. This applies to `implementer`, `architecture-reviewer`, and `plan-verifier`.
- **`test-writer` is NOT invoked.** Test coverage in this run is only the implementer's own TDD tests.
- Single `plan-verifier` pass at the end (no early completeness gate) — the implementer's self-report
  is the cheap completeness signal.

## Workflow (do in order)

### 1. Preflight
- `Read` the plan. Extract: `**Mode:**` (multi-agent | single-agent), the §6 task/track breakdown
  (each task's files, skills, "Done when"), and §9 end-to-end verification commands.
- `Read` the `--spec` if given (for AC-IDs and grounding). Note the spec's AC-IDs so you can map
  each plan "Done when" back to them in the final report.
- Confirm the plan is real and its named files exist (spot-check a couple with `Glob`). If the plan
  looks like a draft with unresolved gaps, surface that and ask before proceeding.

### 2. Implement  ·  `implementer` · sonnet
- **multi-agent mode:** dispatch one `implementer` per non-overlapping track, **all in one message**
  so they run concurrently. Each prompt names ONLY that track's files, its skills (from the plan),
  its "Done when", and the forwarded spec/designs/req context. Stress: stay strictly inside assigned
  files — no worktree isolation, so file ownership is the only conflict guard.
- **single-agent mode:** dispatch one `implementer`, tasks in dependency order.
- Each implementer self-verifies (`pnpm test` + `pnpm typecheck` + lint; `pnpm db:migrate` after a
  schema change) and leaves changes uncommitted. Collect each report (changed files + results).
- If any implementer reports it needs a file owned by another track, resolve the ordering yourself
  (sequence those tasks) rather than letting two agents touch one file.

### 3. Architecture review  ·  `architecture-reviewer` · sonnet
- Dispatch `architecture-reviewer` (model `sonnet`) over the changed files. Give it the plan + the
  list of files the implementers touched.
- It returns findings grouped **Critical / Important / Minor** with `Cn/In/Mn` IDs and `file:line`.

### 4. Fix loop  ·  `implementer` · sonnet
Repeat until no **Critical** and no **Important** findings remain, or `iter == MAX` (default **3**):
1. Collect all Critical + Important findings. Group them by the files/track they touch.
2. Dispatch `implementer`(s) to fix ONLY those findings, scoped to the flagged files. Parallelize
   non-overlapping groups (one message); sequence groups that share files.
3. Each fixer re-runs its package's `pnpm test` + `pnpm typecheck` + lint.
4. Re-run `architecture-reviewer` (sonnet) over the changed files.

- **Minor** findings are reported, never auto-fixed.
- If `MAX` is reached with Critical/Important still open, **stop the loop** and carry the unresolved
  findings into the report — do not loop forever.

### 5. Plan-verify (final)  ·  `plan-verifier` · sonnet
- Dispatch `plan-verifier` (model `sonnet`) with the plan (+ spec if given). It produces the RTM:
  every "Done when" → **Met / Partially met / Not met / No evidence** with `file:line`/test evidence,
  plus a scope-creep scan.
- If any criterion is **Not met** or **No evidence**: report the gap. Offer the human **one** more
  implement round to close it (dispatch a scoped `implementer`, then re-verify) — do not silently
  loop.

### 6. Report
Summarize for the human (nothing is committed):
- **Implemented:** changed files per track + implementer verification results.
- **Architecture review:** fix-loop iterations run; Critical/Important resolved; **remaining Minor**.
- **Verification (RTM):** Met / Partially / Not met / No evidence counts; map each to its spec AC-ID
  when `--spec` was given; scope-creep items.
- **End-to-end check:** the plan's §9 command(s) and, if an implementer ran them, the result.
- **Next step:** "changes are uncommitted — review and commit," plus any unresolved findings/gaps.

## Stop conditions
- No plan path / missing plan file → ask, don't guess.
- Fix loop hits `MAX` with Critical/Important open → stop, report unresolved.
- Verifier finds Not met / No evidence → report; at most one extra implement round on human request.

## What you do NOT do
- You do not run `spec-creator` or `implementation-planner` — those are manual, upstream.
- You do not invoke `test-writer` (disabled for cost).
- You do not commit, push, or open PRs — you leave the working tree uncommitted.
- You do not edit `*/src/vendor/*` or `client/messages/<locale>/*.json`, and never run
  `docker compose down -v`.
- You do not override agent frontmatter — model selection is per-dispatch (`model: "sonnet"`).
