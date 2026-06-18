# e2e/specs

This folder holds **two kinds** of spec, which work together:

### 1. Flow specs — `NN-name.flow.json` (executable)

The runnable agent-browser flows. Each is a JSON list of commands executed in
order by `../run.ts` against one shared browser session. `wait --text` /
`wait --url` are the assertions (non-zero exit fails the flow). These are the
source of truth for *what actually runs in CI* (`e2e-web.yml`). See
[../README.md](../README.md) for the flow format and the seeded-data precondition.

Current flows:

| Spec | Flow |
|------|------|
| `01-app-boot` | root → redirect to first repo's PR list → seeded PR #482 |
| `02-repo-pulls-detail` | PR list → open PR #482 → review detail route |
| `03-agents` | agents list renders the seeded reviewer agents |
| `04-pr-findings` | PR #482 → Agent runs tab → verdict + findings; expand → FindingCard |
| `05-pr-diff` | PR #482 → Files changed tab → seeded file in the diff viewer |
| `06-onboarding` | `/onboarding` → add-repository form renders (no submit) |
| `07-settings` | `/settings/api-keys` + `/settings/models` → section titles render |

### 2. Written specs — `*.md` (prose)

Human-readable behavior specs for journeys not yet (or not easily) expressed as a
flow: intended states, edge cases, and acceptance criteria. A written spec is the
*intent*; a `*.flow.json` is its executable check. Keep them named to match
(`<journey>.md` ↔ `NN-<journey>.flow.json`) so the pair is easy to find.

| Spec | Summary |
|------|---------|
| _(none yet)_ | Add `<journey>.md` written specs here. |
