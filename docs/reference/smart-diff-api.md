# Smart Diff API Reference

`GET /pulls/:id/smart-diff` returns a deterministic, reviewer-ordered view of a
pull request's changed files. The endpoint makes no LLM call and writes nothing
to the database.

## Endpoint

```
GET /pulls/:id/smart-diff
```

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | The pull request ID (workspace-scoped). |

A non-UUID value for `id` returns `422` before the handler runs — the route
schema validates `params` with `IdParams` via `fastify-type-provider-zod`.

### Authentication / scoping

The endpoint resolves the workspace from the authenticated session context
(`getContext`). A PR that belongs to a different workspace returns `404`.

### Rate limiting

No module-level rate limit is configured. The endpoint is compute-only (classify
+ group existing DB rows); the global 120 req/min cap applies.

## Status codes

| Code | Meaning |
|------|---------|
| `200` | Success — body is a `SmartDiff` object. |
| `404` | Pull request not found, or it belongs to a different workspace. |
| `422` | `id` is not a valid UUID. |

## Response shape

```ts
type SmartDiff = {
  groups: SmartDiffGroup[];
  split_suggestion: {
    too_big: boolean;
    total_lines: number;
    proposed_splits: ProposedSplit[];
  };
};

type SmartDiffGroup = {
  role: SmartDiffRole;   // "core" | "wiring" | "boilerplate"
  files: SmartDiffFile[];
};

type SmartDiffFile = {
  path: string;
  pseudocode_summary: string | null | undefined;
  additions: number;
  deletions: number;
  finding_lines: number[];
};

type ProposedSplit = {
  name: string;   // top-level directory, or "(root)" for repo-root files
  files: string[];
};
```

All types are validated server-side with `SmartDiff.parse()` before the response
is sent; the client receives a schema-valid object or an error.

### `groups`

Always contains exactly three elements in fixed order: `core`, `wiring`, and
`boilerplate`. A group may contain zero files; it is never omitted.

### `SmartDiffFile` fields

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Repository-relative file path, forward slashes. |
| `additions` | `number` | Lines added in this file. |
| `deletions` | `number` | Lines deleted in this file. |
| `finding_lines` | `number[]` | Line numbers flagged by the latest review's findings for this file. Empty when no review has been run. |
| `pseudocode_summary` | `string \| null` | Short deterministic summary derived from finding rationales — the first sentence of each rationale, joined with `"; "` and truncated at 200 characters. `null` when the file has no findings or no review exists. |

### `split_suggestion`

| Field | Type | Description |
|-------|------|-------------|
| `too_big` | `boolean` | `true` when the sum of `additions + deletions` across **core** files exceeds `SPLIT_TOO_BIG_LINES` (400). |
| `total_lines` | `number` | Sum of additions and deletions across core files only. |
| `proposed_splits` | `ProposedSplit[]` | Core files grouped by top-level directory. Files at the repository root are bucketed under the name `"(root)"`. |

## Role enum

| Value | Meaning |
|-------|---------|
| `"core"` | Primary logic files — everything not matched by a wiring or boilerplate pattern. |
| `"wiring"` | Config files, CI pipelines, barrel re-exports, infrastructure. |
| `"boilerplate"` | Lock files, build outputs, snapshots, source maps, minified assets. |

Classification precedence is **boilerplate → wiring → core**: a file that matches
both a boilerplate and a wiring pattern is classified as boilerplate.

## Example response

```json
{
  "groups": [
    {
      "role": "core",
      "files": [
        {
          "path": "server/src/modules/payments/service.ts",
          "additions": 42,
          "deletions": 8,
          "finding_lines": [17, 35],
          "pseudocode_summary": "Missing input validation on amount field"
        }
      ]
    },
    {
      "role": "wiring",
      "files": [
        {
          "path": "server/src/modules/index.ts",
          "additions": 2,
          "deletions": 0,
          "finding_lines": [],
          "pseudocode_summary": null
        }
      ]
    },
    {
      "role": "boilerplate",
      "files": [
        {
          "path": "pnpm-lock.yaml",
          "additions": 120,
          "deletions": 80,
          "finding_lines": [],
          "pseudocode_summary": null
        }
      ]
    }
  ],
  "split_suggestion": {
    "too_big": false,
    "total_lines": 50,
    "proposed_splits": [
      { "name": "server", "files": ["server/src/modules/payments/service.ts"] }
    ]
  }
}
```

## Client hook

The web app fetches this endpoint via `usePrSmartDiff` in
`client/src/lib/hooks/brief.ts`:

```ts
function usePrSmartDiff(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["smart-diff", prId],
    queryFn: () => api.get<SmartDiff>(`/pulls/${prId}/smart-diff`),
    enabled: !!prId,
  });
}
```

The hook is disabled when `prId` is null — the `DiffTab` component passes `null`
when the "Original order" toggle is active.

## Source locations

| File | Role |
|------|------|
| `server/src/modules/smart-diff/routes.ts` | Fastify plugin, route registration |
| `server/src/modules/smart-diff/service.ts` | `buildSmartDiff` — compose logic |
| `server/src/modules/smart-diff/classify.ts` | `classifyFile` — pure role classifier |
| `server/src/modules/smart-diff/constants.ts` | Pattern lists, `SPLIT_TOO_BIG_LINES`, `ROOT_BUCKET` |
| `server/src/vendor/shared/contracts/brief.ts` | `SmartDiff` Zod schema (lines 80–113) |
| `client/src/lib/hooks/brief.ts` | `usePrSmartDiff` React Query hook |
