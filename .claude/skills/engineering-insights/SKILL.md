---
name: engineering-insights
description: >-
  Use when a session involved a non-obvious problem, gotcha, decision, surprising
  behavior, or hard-won discovery worth remembering — and at the end of any such
  session before wrapping up. Triggers on finishing a task, "wrap up", "we're done",
  capturing a lesson/insight/gotcha, or noticing something a future session would
  repeat a mistake on. Routes per touched module (client/server/reviewer-core/e2e)
  or the repo root for cross-cutting work.
metadata:
  tags: insights, learnings, capture, wrap-up, gotcha, lesson, memory, retrospective
---

# Engineering Insights

## Overview

A per-module `INSIGHTS.md` is **notes the previous session left for the next one** —
the cheapest way to stop re-discovering the same gotchas. This skill captures those
notes into the **right module's file**, append-only, at a quality bar high enough
that a future agent reading them *cold* knows what to do.

**The capture is the work, not optional politeness.** "The user said it's done" is
the moment to capture, not skip — wrap-up is part of finishing.

## Routing — which file

Write to the `INSIGHTS.md` of the module the work actually touched:

| Work touched | File |
|---|---|
| `client/**` | `client/INSIGHTS.md` |
| `server/**` | `server/INSIGHTS.md` |
| `reviewer-core/**` | `reviewer-core/INSIGHTS.md` |
| `e2e/**` | `e2e/INSIGHTS.md` |
| repo root, `scripts/`, CI, or spans ≥2 packages | `INSIGHTS.md` (repo root) |

Module obvious → just write there. Genuinely cross-cutting → root file. Genuinely
ambiguous (and not cross-cutting) → ask the user which file. Uncertainty is **not**
a reason to skip — pick the closest module or root.

## The 7 fixed sections (every INSIGHTS.md)

`## What Works` · `## What Doesn't Work` · `## Codebase Patterns` ·
`## Tool & Library Notes` · `## Recurring Errors & Fixes` · `## Session Notes` ·
`## Open Questions`

**What Doesn't Work is the most-skipped and most-valuable section** — antipatterns
and dead ends save the next session the most time. Don't skip it.

Mental model for *what* to capture (maps onto the sections): **Patterns** (→ What
Works / Codebase Patterns) · **Mistakes** (→ What Doesn't Work / Recurring Errors) ·
**Decisions** with reasoning (→ Codebase Patterns) · **Context / quirks** (→ Tool &
Library Notes).

## Workflow

1. **Read first.** Before working in a module, read its `INSIGHTS.md` and summarize
   the points relevant to today's task. Treat them as high-confidence guidance.
2. **Re-read before writing.** At wrap-up, re-read the target section so you don't
   duplicate an entry that's already there.
3. **Append** new entries under the matching section. **Only append, or correct an
   existing entry with a dated note — never overwrite or delete history.**

## Entry format

```
- **YYYY-MM-DD** — <cold-actionable insight> (evidence: path/file.ts:line)
```

The evidence pointer is what makes it cold-actionable — name the file:line that
proves it. The code shows *the fix*; the entry captures *the trap that made it hard*.

## Quality bar — concrete, not banal

Test: **"if this were obvious to anyone reading the code, don't write it."**

| ❌ Banal (noise) | ✅ Cold-actionable (insight) |
|---|---|
| "Promises can be tricky" | "`Promise.all()` on the ingest pipeline times out past ~30 items — use `Promise.allSettled()` in batches of 10" |
| "be careful with async" | "checkout state always flows through Zustand (`cartStore.ts`) — 3 components share the cart; local state breaks it" |

## Substance gate

Write **only** substantial, non-obvious insights that aren't already recorded.
**If nothing this session clears the bar, write nothing** — and say so. A clean
"nothing substantial to add" is a valid, correct outcome. Never pad the file.

## Promotion to CLAUDE.md

When an entry proves recurring or critical, promote a one-liner up into that
module's `CLAUDE.md` **Gotchas** (the repo's existing line test: "if I remove this,
will Claude start making mistakes?"). The `INSIGHTS.md` entry stays as the detail.

## Red flags — STOP, you're rationalizing a skip

| Rationalization | Reality |
|---|---|
| "The user said it's done, don't overstep" | Wrap-up capture *is* finishing the task, not new work. Capture, then close. |
| "CLAUDE.md is a map / do-not-touch" | `INSIGHTS.md` is the opposite of a map — it exists to be appended to. It is not on any do-not-touch list. |
| "The fix code already documents it" | Code shows the fix; it does not show the silent trap that cost 40 min to find. Capture the trap. |
| "I might put it in the wrong place" | Pick the closest module or the root file. Wrong-but-recorded beats lost. |
| "It's a short/simple change" | Short sessions skip capture; that's fine. Sessions with a real problem/decision/discovery do not. |

## Common mistakes

- Skipping wrap-up (the #1 failure — the loop only compounds if it runs).
- Generic entries that fail the banality test.
- Duplicating an entry already present (re-read first).
- Letting a file grow unbounded — prune/split around ~200 entries; review monthly.
