# Agents

Subagents the team can delegate to via the Task tool. Canonical location is `.claude/agents/`,
shared via version control. Each agent is a single Markdown file: YAML frontmatter (`name`,
`description`, `tools`, `skills`, `model`, `color`) plus a system-prompt body.

## Catalog

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| [researcher](researcher.md) | sonnet | read-only + web | Single-pass factual lookup from the project **or** the internet; returns a strict, cited report, never guesses. |
| [spec-creator](spec-creator.md) | opus | `Read, Grep, Glob, Write, Edit, WebFetch, Skill` | Authors a **Spec** (SDD) from a feature idea + design sources: analyzes the design for corner cases, cross-module gaps, and UX improvements, then writes one `Status: draft` spec (fixed template + EARS acceptance criteria) — single-module → `<module>/specs/`, cross-module → top-level `specs/` — and updates that folder's README index. Writes **only** `specs/**` and `*/specs/**` (not `e2e/specs`); never guesses — open items go to `[NEEDS CLARIFICATION]`. First pipeline stage, before the planner. |
| [implementation-planner](implementation-planner.md) | opus | read-only (`Read, Grep, Glob, Skill`) | Turns **already-defined requirements** into a structured, phased **Implementation Plan** under `docs/plans/`, with per-task file lists, skill assignments, and distilled INSIGHTS. Reviews the requirements for gaps, clarifies, recommends improvements, and asks single- vs multi-agent mode. Never authors specs; plan-only. |
| [implementer](implementer.md) | sonnet | `Read, Edit, Write, Grep, Glob, Bash, Skill, TodoWrite` | Implements **one** plan task (backend or UI), routing skills by module, working TDD, self-verifying code only. Runs in parallel; leaves changes uncommitted. |
| [test-writer](test-writer.md) | sonnet | `Read, Edit, Write, Grep, Glob, Bash, Skill, TodoWrite` | Authors tests for the **UI** (`client/`, RTL+jsdom) and **backend** (`server/`/`reviewer-core/`, Fastify `.inject()` / testcontainers), routing skills by module; tests the seams, never weakens an assertion or edits product code to pass. |
| [architecture-reviewer](architecture-reviewer.md) | opus | read-only (`Read, Grep, Glob, Skill`) | **Architectural** review (boundaries, dependency direction, coupling/cohesion, contracts, trust boundaries) at C4 Container/Component altitude — not line-style nitpicks, not a full security audit. Findings grouped Critical/Important/Minor with a recommendation, not a rewrite. |
| [plan-verifier](plan-verifier.md) | opus | read-only + evidence Bash (`Read, Grep, Glob, Skill, Bash`) | Verifies a **plan was actually built**: traces every requirement / "Done when" to evidence (`file:line` or a passing test), marking Met / Partially met / Not met / No evidence, and flags scope-creep. Evidence-based, never guesses. |
| [doc-writer](doc-writer.md) | sonnet | `Read, Edit, Write, Grep, Glob, Skill, TodoWrite` | Writes **documentation** (docs only): documents built features, turns plans into forward-looking RFC/design docs, and adds Mermaid diagrams — choosing the doc kind and destination deterministically via Diátaxis. |

## How they fit together

```
spec-creator ──▶ */specs/<feature>.md ──▶ implementation-planner ──▶ docs/plans/<slug>.md ──▶ implementer × N (parallel) ──▶ uncommitted changes
                            │                         │                              │
                            │                         └─ researcher (on demand)      ├─ test-writer (adds tests)
                            │                                                        ├─ architecture-reviewer (read-only)
                            └──────────────── plan-verifier (plan vs. changes) ──────┤
                                                                                     └─ doc-writer (writes docs/**)
```

The **implementation-planner** breaks work into non-overlapping tracks (by file set) so multiple **implementer**
agents can run concurrently without colliding — there is no worktree isolation, so file ownership
is the conflict guard. The **researcher** is an independent read-only helper for factual lookups.

Once changes exist, three lenses can run over them, each in fresh context: **test-writer** adds the
tests, **architecture-reviewer** judges the structure read-only, and **plan-verifier** checks the
plan's requirements were actually met (read-only, evidence-based). **doc-writer** then documents the
result (or converts the plan into a design doc), writing only under `docs/**`. The two read-only
reviewers and the verifier grant **no write tools** — their scope is enforced by tooling, not just
instructions.

## What the agents are based on

### implementation-planner & implementer

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

### test-writer

A write-access agent that authors tests for both surfaces — the **UI** (`client/`, React Testing
Library + jsdom) and the **backend** (`server/`/`reviewer-core/`, Fastify `.inject()` and
testcontainers-backed `*.it.test.ts`). Designed from published testing guidance, adapted to
DevDigest's "typological, not exhaustive" philosophy (see `TESTING.md`):

- **Test the seams, not internals.** Tests target what the two "users" of code see — the end-user
  (rendered DOM, events) and the developer-user (props, public signatures) — not implementation
  details; use-case coverage over line coverage.
- **RTL discipline.** `getByRole` first / `getByTestId` last; `userEvent` over `fireEvent`; no
  assertion-free `get*` calls; no empty `waitFor`.
- **Mock the process boundary, not your own code.** LLM/GitHub/git via `src/adapters/mocks.ts`,
  `fetch` on the client — never the system's internals.
- **Never cheat the test.** It never weakens or deletes an assertion to go green, and never edits
  product code solely to accommodate a test — it fixes the code or reports the bug.

### architecture-reviewer

A **read-only** agent (no write tools — enforced by tool scoping) that reviews a change at the
**architectural** altitude, in fresh context, because the author of a change is not its best critic:

- **Evaluates** separation of concerns, dependency direction/inversion, bounded contexts,
  coupling/cohesion, layer violations, contract design, and trust boundaries — at C4
  Container/Component level, not line-by-line.
- **Stays in its lane.** Not a style/lint pass, not a full security audit; uses "judgment over
  rules" — it does not flag patterns consistent with the surrounding codebase.
- **Outputs** findings grouped Critical / Important / Minor, anchored to `file:line`, each with a
  recommendation rather than a rewrite.

### plan-verifier

A **read-only** agent that answers one question: *was the plan actually built?* It performs
**verification against the spec** (not validation of the spec), modeled on requirements
traceability:

- **Traces every requirement / "Done when"** to evidence — a `file:line` citation or a named
  passing test — marking each Met / Partially met / Not met / **No evidence**.
- **Evidence-based, never guesses.** Absence of evidence is itself a finding (status *No evidence*),
  not an assumed pass; a separate verifier is used because the author isn't the best judge of their
  own coverage.
- **Detects scope-creep** via backward traceability (work present with no matching requirement).
- **Stays in its lane.** Requirement coverage and correctness-against-spec only — not architecture
  (that's `architecture-reviewer`) and not writing tests (that's `test-writer`). Its `Bash` is for
  running an existing suite as read-only evidence; it never mutates.

### doc-writer

A docs-only write-access agent that documents built features, converts plans into forward-looking
design docs, and turns handed-in material into documentation with diagrams:

- **Diátaxis** decides the doc *kind* by reader intent — tutorial / how-to / reference /
  explanation — and never mixes types on one page; explanation is reserved for built code.
- **Deterministic placement.** An input→type→location table routes each doc to `docs/tutorials|how-to|reference|explanation/`,
  ADRs to `docs/adr/NNNN-verb-noun.md`, a plan-turned-proposal to an RFC under `docs/rfcs/`, and
  overviews to README files.
- **Docs-as-code + diagrams-as-code.** Markdown, lowercase-hyphen filenames, Mermaid embedded so it
  diffs in PRs; Google developer style (present tense for built features, future tense for plans).
- **Write boundaries.** Writes only under `docs/**` and package `README.md`s — never vendored code,
  translation files, or product source/tests.

## Sources

Best practices behind **implementation-planner** and **implementer**:

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

Best practices behind **test-writer**:

- [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents) — give a test agent the write/Bash tools to author and run suites.
- [Best practices for Claude Code — Claude Code Docs](https://code.claude.com/docs/en/best-practices) — "give Claude a check it can run (tests)"; "address root causes, not symptoms".
- [Characterization tests or approval tests? — understandlegacycode.com](https://understandlegacycode.com/blog/characterization-tests-or-approval-tests/) — characterization tests for already-built code; red-green TDD when code is written alongside tests.
- [Testing Implementation Details — Kent C. Dodds](https://kentcdodds.com/blog/testing-implementation-details) — test the two "users" (end-user + dev-user), not internals.
- [How to know what to test — Kent C. Dodds](https://kentcdodds.com/blog/how-to-know-what-to-test) — use-case coverage over line coverage.
- [Common mistakes with React Testing Library — Kent C. Dodds](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) — no assertion-free `get*`; `userEvent` over `fireEvent`; no empty `waitFor`.
- [About Queries — Testing Library](https://testing-library.com/docs/queries/about/) — query priority: `getByRole` first, `getByTestId` last.
- [Mocks Aren't Stubs — Martin Fowler](https://martinfowler.com/articles/mocksArentStubs.html) — use real objects when practical; mock only awkward collaborators.
- [Testing in Practice — Vitest Guide](https://main.vitest.dev/guide/learn/testing-in-practice) — mock the process boundary, not internals; "if refactoring breaks the test, you're testing implementation details".
- [Testing — Fastify Docs](https://fastify.dev/docs/latest/Guides/Testing/) — `.inject()` exercises the full lifecycle without a real server.
- [PostgreSQL — Testcontainers for Node.js](https://node.testcontainers.org/modules/postgresql/) — real Postgres in `beforeAll`/`afterAll` for integration tests.

Best practices behind **architecture-reviewer**:

- [Best practices for AI Agents, Subagents, Skills and MCP — foojay.io](https://foojay.io/today/best-practices-for-working-with-ai-agents-subagents-skills-and-mcp/) — a read-only agent can't be coerced into writing; scope by tools, not instructions.
- [Architectural principles — Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles) — separation of concerns, dependency inversion, bounded contexts, persistence ignorance.
- [Why SOLID principles are still the foundation for modern software architecture — Stack Overflow Blog](https://stackoverflow.blog/2021/11/01/why-solid-principles-are-still-the-foundation-for-modern-software-architecture/) — SOLID at architecture scale (cascading failures, service sprawl).
- [Linking Modular Architecture to Development Teams — Martin Fowler](https://martinfowler.com/articles/linking-modular-arch.html) — minimize coupling, maximize cohesion, reduce blast radius.
- [The C4 Model — c4model.com](https://c4model.com/) — review at Container/Component altitude, not Code level.
- [Architecture Decision Record — Martin Fowler](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html) — compare a change against accepted ADRs to detect drift.
- [Encoding Team Standards — Martin Fowler](https://martinfowler.com/articles/reduce-friction-ai/encoding-team-standards.html) — classify findings must/should/nice; "judgment over rules" to avoid nitpicking.

Best practices behind **plan-verifier**:

- [Verification and validation — Wikipedia](https://en.wikipedia.org/wiki/Verification_and_validation) — "are we building it right?" (verification, spec-facing) vs "the right thing?" (validation).
- [IEEE 1012 (V&V) — Future Skill](https://futureskill.blog/standards/ieee-1012/) — requirements traceable through all lifecycle stages; structured V&V reporting.
- [Requirements Traceability Matrix: A How-To Guide — TestRail](https://www.testrail.com/blog/requirements-traceability-matrix/) — RTM columns; status (lifecycle) vs result (verdict).
- [How to Create and Use a Requirements Traceability Matrix — Jama Software](https://www.jamasoftware.com/requirements-management-guide/requirements-traceability/how-to-create-and-use-a-requirements-traceability-matrix-rtm/) — validate both directions; orphaned requirements and orphaned code.
- [Analyze Requirements Coverage Gaps — ReqView](https://www.reqview.com/blog/2017-09-13-tips-requirements-coverage-gaps/) — coverage states Covered / Partially covered / Not covered.
- [Requirements Coverage Analysis — Visure Solutions](https://visuresolutions.com/alm-guide/requirements-coverage/) — requirements coverage ≠ code coverage; detect untested requirements.
- [Acceptance Criteria vs Definition of Done — AltexSoft](https://www.altexsoft.com/blog/acceptance-criteria-definition-of-done/) — AC verifies the story; DoD verifies readiness.
- [Acceptance Test-Driven Development — Agile Alliance](https://agilealliance.org/glossary/atdd/) — acceptance tests as executable requirements.
- [How I Validate Quality When AI Agents Write My Code — DEV.to](https://dev.to/teppana88/how-i-validate-quality-when-ai-agents-write-my-code-481c) — "no evidence, no report"; separate validator from author.
- [How to Conduct a Gap Assessment — Hyperproof](https://hyperproof.io/resource/how-to-conduct-a-gap-assessment/) — "where evidence does not exist, the absence itself becomes a finding".
- [How to Write Acceptance Criteria an AI Agent Can Verify — BrainGrid](https://www.braingrid.ai/blog/how-to-write-acceptance-criteria-ai-agent-can-verify) — verifiable, unambiguous criteria (Given-When-Then).
- [How to Write a Good Spec for AI Agents — Addy Osmani](https://addyosmani.com/blog/good-spec/) — conformance tests derived from the spec are the definition of done.

Best practices behind **doc-writer**:

- [Diátaxis framework](https://diataxis.fr/) — four doc types on reader-intent axes (tutorials / how-to / reference / explanation); never mix types; explanation needs built code.
- [Docs as Code — Write the Docs](https://www.writethedocs.org/guide/docs-as-code/) — docs in-repo, Markdown, PR-reviewed, part of definition of done.
- [Docs-as-Code Best Practices — APIdog](https://apidog.com/blog/docs-as-code-best-practices/) — lowercase-hyphen filenames; document during development.
- [Mermaid — Introduction](https://mermaid.js.org/intro/) — text-defined diagrams travel with the code; embed in Markdown so they diff in PRs.
- [Documenting Architecture Decisions — Michael Nygard / Cognitect](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — ADRs as short, numbered, present-tense decision records.
- [Architecture Decision Record (README) — joelparkerhenderson](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/README.md) — community convention `docs/adr/NNNN-verb-noun.md`.
- [RFC and Design Doc Examples and Templates — The Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/software-engineering-rfc-and-design) — forward-looking design-doc sections (goals/non-goals, alternatives, open questions).
- [RFC Template — Lambros Petrou](https://www.lambrospetrou.com/articles/rfc-template/) — RFC status lifecycle Draft → Approved.
- [Developer Documentation Style Guide — Google](https://developers.google.com/style/highlights) — second person, active voice, present tense, no "simply/just".

## Creating new agents

Add a `<name>.md` file with frontmatter (`name`, `description` written as a delegation router with
`<example>` blocks, explicit `tools`, optional `skills`/`model`/`color`) and a system-prompt body.
Then add a row to the Catalog above.
