# How to Review a PR with Smart Diff

Smart Diff reorders the "Files changed" tab so the most important files appear
first. This guide explains how to use each part of the view.

## Open the Files changed tab

Navigate to a pull request in the DevDigest studio and click the **Files
changed** tab. The tab opens in Smart order by default.

## Switch between Smart order and Original order

A toggle in the top-right of the Files changed header lets you switch between:

- **Smart order** — files grouped by role (core → wiring → boilerplate), with
  review findings annotated.
- **Original order** — the flat, alphabetical diff exactly as GitHub reports it,
  with inline comment support.

Click **Original order** to see the flat view. Click **Smart order** to return to
the reviewer-ordered view.

Smart Diff is always on — there is no feature flag to enable.

## Read the three groups

Smart order groups files into three sections:

| Group | What it contains |
|-------|-----------------|
| **CORE LOGIC** | The primary logic change — the files that matter most to review. |
| **WIRING** | Configuration, entry points, and integration plumbing. |
| **BOILERPLATE** | Lock files, snapshots, generated output, and other noise. |

Core and Wiring groups start expanded. Boilerplate starts collapsed.

Click a group header to collapse or expand the entire group.

## Jump to a flagged file

When the latest review has flagged files, each flagged file shows a colored "N
findings" badge in its header. The badge color reflects the **highest severity**
finding on that file:

- Red — `CRITICAL`
- Orange — `WARNING`
- Blue — `SUGGESTION`

Click the badge to expand the file and scroll directly to the first flagged line.

## Read per-line severity markers

Every line that a finding references carries a colored dot on the right edge of
that line. Hover over the dot to see the severity label. Use the line number
shown in the line gutter to cross-reference with the Findings panel below the
diff.

## Read the pseudocode summary

Files with findings also display a short italic summary in the file header,
truncated to fit the header row. Hover over the summary text to read the full
version. The summary is a concatenation of the first sentence from each finding
rationale on that file — it gives you a one-line hint before you expand the diff.

## Act on a split-suggestion banner

When the core change is large (more than 400 lines of additions and deletions
across core files), a yellow banner appears at the top of the Smart Diff view:

> **Large core change — consider splitting this PR**

The banner lists the proposed directory splits. Each split shows a top-level
directory name and the number of core files inside it. You can use this as a
guide for breaking the PR into smaller, reviewable pieces before approval.

## Fall back to Original order

If the smart-diff data is unavailable (for example, because no files have been
imported yet), the view falls back to Original order automatically. You can also
switch manually at any time using the toggle.

## Related

- [Smart Diff API reference](../reference/smart-diff-api.md) — full endpoint and
  response shape for API consumers.
- [Smart Diff — how it works](../explanation/smart-diff.md) — architectural
  explanation of the classification and compose flow.
