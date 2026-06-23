# Agents

Subagents the team can delegate to via the Task tool. Canonical location is `.claude/agents/`,
shared via version control. Each agent is a single Markdown file: YAML frontmatter (`name`,
`description`, `tools`, `skills`, `model`, `color`) plus a system-prompt body.

## Catalog

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| [researcher](researcher.md) | sonnet | read-only + web | Single-pass factual lookup from the project **or** the internet; returns a strict, cited report, never guesses. |
| [planner](planner.md) | opus | read-only (`Read, Grep, Glob, Skill`) | Turns a request into a structured, phased **Development Plan** under `docs/plans/`, with per-task file lists, skill assignments, and distilled INSIGHTS. Plan-only. |
| [implementer](implementer.md) | sonnet | `Read, Edit, Write, Grep, Glob, Bash, Skill, TodoWrite` | Implements **one** plan task (backend or UI), routing skills by module, working TDD, self-verifying code only. Runs in parallel; leaves changes uncommitted. |

## How they fit together

```
request ──▶ planner ──▶ docs/plans/<slug>.md ──▶ implementer × N (parallel) ──▶ uncommitted changes
                                                      │
                                                      └─ researcher (on demand, read-only lookups)
```

The **planner** breaks work into non-overlapping tracks (by file set) so multiple **implementer**
agents can run concurrently without colliding — there is no worktree isolation, so file ownership
is the conflict guard. The **researcher** is an independent read-only helper for factual lookups.

## What the agents are based on

### planner & implementer

Both were designed from a survey of published best practices for agentic coding (see **Sources**
below), adapted to DevDigest's module layout and skills. Key practices applied:

- **Plan-only, read-only planner.** Modeled on Claude Code's built-in "Plan" subagent (read-only
  tools, `permissionMode: plan`). Separating research/planning from implementation avoids "solving
  the wrong problem."
- **Self-contained, phased plans.** The plan names real files, states what is out of scope, orders
  tasks DB → API → frontend, and ends with a runnable end-to-end verification step.
- **Skill-aware planning + module-routed skills.** The planner assigns project skills per task; the
  implementer routes skills by the module it touches (backend for `server/`/`reviewer-core/`,
  frontend for `client/`, full-stack always). Skills are declared in each agent's `skills:`
  frontmatter so they are preloaded, and referenced in a body routing table.
- **Parallel-safe by file ownership.** With no worktree isolation, tasks are partitioned into
  non-overlapping file sets ("shared context without shared state"), ≤3–5 parallel tracks.
- **TDD, tests-must-pass.** The implementer makes tests pass without weakening or rewriting them.
- **Implementer self-verifies code only.** It runs tests + typecheck + lint and a light
  code-quality self-review — it does *not* perform a full security/edge-case/performance audit (a
  separate reviewer's lens), because the author of a change is not its best critic.
- **Hybrid INSIGHTS loading.** The planner distills cross-cutting + module INSIGHTS into the plan;
  each implementer reads only its own module's `INSIGHTS.md` on-location, keeping context lean.

### researcher

A read-only, single-pass factual lookup agent with two fixed report formats (Project / Internet)
and a strict "never guess — report NOT FOUND with what was searched" rule. House-style reference
for the frontmatter + body structure used by the other agents.

## Sources

Best practices behind **planner** and **implementer**:

- [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents) — frontmatter fields (`tools`, `skills`, `model`, `permissionMode`), built-in Plan subagent, "subagent sees only its own system prompt."
- [Best practices for Claude Code — Claude Code Docs](https://code.claude.com/docs/en/best-practices) — separate research/planning from implementation; self-contained specs; verification-first.
- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills) — skill loading, progressive disclosure, on-demand by location.
- [How Claude remembers your project — Claude Code Docs](https://code.claude.com/docs/en/memory) — on-demand loading of nested context (CLAUDE.md / INSIGHTS) by location.
- [Orchestrate teams of Claude Code sessions — Claude Code Docs](https://code.claude.com/docs/en/agent-teams) — parallel agents, non-overlapping file ownership, ≤3–5 agents.
- [Run parallel sessions with worktrees — Claude Code Docs](https://code.claude.com/docs/en/worktrees) — isolation tradeoffs (we opted out; file ownership is the guard instead).
- [Equipping agents for the real world with Agent Skills — Anthropic Engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — skills as modular, on-demand domain knowledge.
- [Designing Sub-Agents for Planning (Meet @architect) — DEV / Cristian Sifuentes](https://dev.to/cristiansifuentes/conversational-development-with-claude-code-part-7-designing-sub-agents-for-planning-meet-1nlk) — architect prompt structure and plan output sections.
- [Best practices for Claude Code subagents — PubNub](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/) — `description` as delegation router; be explicit with `tools`.
- [How to Build a Self-Verification Loop in Claude Code — DEV](https://dev.to/shipwithaiio/how-to-build-a-self-verification-loop-in-claude-code-3-layers-20-minutes-m1p) — implementer self-checks (lint/types/tests) vs. what a dedicated reviewer owns.
- [Auto-Reviewing Claude's Code — Nick Tune](https://medium.com/nick-tune-tech-strategy-blog/auto-reviewing-claudes-code-cb3a58d0a3d0) — fresh context for review; author isn't the best critic.
- [A Claude Code TDD Skill — alexop.dev](https://alexop.dev/posts/custom-tdd-workflow-claude-code-vue/) and [Claude Code TDD workflow — ClaudeWorld](https://claude-world.com/articles/claude-code-tdd-workflow/) — red-green-refactor; don't alter tests to pass.
- [Parallel Agentic Development With Git Worktrees — MindStudio](https://www.mindstudio.ai/blog/parallel-agentic-development-git-worktrees) — shared contracts before parallel work; file-set ownership.

## Creating new agents

Add a `<name>.md` file with frontmatter (`name`, `description` written as a delegation router with
`<example>` blocks, explicit `tools`, optional `skills`/`model`/`color`) and a system-prompt body.
Then add a row to the Catalog above.
