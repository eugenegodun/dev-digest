/**
 * history.ts — derive `PrHistory` for the PR Brief.
 *
 * Finds the prior MERGED pull requests in the same repo that touched at least
 * one file also touched by the current PR.
 *
 * DATA AVAILABILITY NOTE
 * ─────────────────────
 * The `pull_requests` table persists `status` (text: 'open' | 'merged' |
 * 'closed') and `updated_at` (timestamptz). There is NO dedicated `merged_at`
 * column. For merged PRs `updated_at` is set by GitHub at merge time and is the
 * best available approximation; it is surfaced as `merged_at` in the contract.
 * File paths ARE persisted in `pr_files.path` per PR, so file-overlap queries
 * work against local data without new external calls.
 *
 * If neither persisted merged PRs nor their file data exist (e.g. the database
 * has been freshly seeded with only the current PR), this function returns
 * `{ history: [] }` — it never throws on empty data.
 */

import { and, eq, inArray, ne } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { PrHistory, PrHistoryItem } from '../../vendor/shared/contracts/brief.js';

/** Maximum number of history items returned. */
const MAX_HISTORY_ITEMS = 10;

export interface DeriveHistoryInput {
  /** UUID of the repository (scopes the search to the same repo). */
  repoId: string;
  /** UUID of the current PR (excluded from its own history). */
  prId: string;
  /** File paths touched by the current PR (the overlap candidates). */
  changedFiles: string[];
}

/**
 * Compute `PrHistory` — the list of prior merged PRs in the same repo whose
 * changed files overlap with `changedFiles`.
 *
 * Query strategy (pure DB, no external calls):
 *   1. Collect all PRs in the repo with `status = 'merged'`, excluding the
 *      current PR.
 *   2. Join `pr_files` to find which of those PRs touched a file that also
 *      appears in `changedFiles`.
 *   3. Group by PR, compute the per-PR intersection, and map to `PrHistoryItem`.
 *   4. Cap to `MAX_HISTORY_ITEMS` results.
 *
 * @returns A Zod-validated `PrHistory`. Always returns `{ history: [] }` when
 *          no qualifying PRs exist or when `changedFiles` is empty.
 */
export async function deriveHistory(
  db: Db,
  repoId: string,
  input: DeriveHistoryInput,
): Promise<PrHistory> {
  const { prId, changedFiles } = input;

  // Fast exit: nothing to intersect.
  if (changedFiles.length === 0) {
    return PrHistory.parse({ history: [] });
  }

  // 1. Find merged PRs in the repo (excluding the current one).
  const mergedPrs = await db
    .select({
      id: t.pullRequests.id,
      number: t.pullRequests.number,
      title: t.pullRequests.title,
      author: t.pullRequests.author,
      updatedAt: t.pullRequests.updatedAt,
    })
    .from(t.pullRequests)
    .where(
      and(
        eq(t.pullRequests.repoId, repoId),
        eq(t.pullRequests.status, 'merged'),
        ne(t.pullRequests.id, prId),
      ),
    );

  if (mergedPrs.length === 0) {
    return PrHistory.parse({ history: [] });
  }

  // 2. Fetch `pr_files` rows for those merged PRs that share at least one path
  //    with `changedFiles`.
  const mergedPrIds = mergedPrs.map((pr) => pr.id);
  const changedFileSet = new Set(changedFiles);

  const overlappingFiles = await db
    .select({ prId: t.prFiles.prId, path: t.prFiles.path })
    .from(t.prFiles)
    .where(
      and(
        inArray(t.prFiles.prId, mergedPrIds),
        inArray(t.prFiles.path, changedFiles),
      ),
    );

  if (overlappingFiles.length === 0) {
    return PrHistory.parse({ history: [] });
  }

  // 3. Group overlap paths by PR id.
  const overlapByPrId = new Map<string, string[]>();
  for (const row of overlappingFiles) {
    if (!overlapByPrId.has(row.prId)) overlapByPrId.set(row.prId, []);
    overlapByPrId.get(row.prId)!.push(row.path);
  }

  // 4. Build the history items for PRs that have at least one overlap.
  const prById = new Map(mergedPrs.map((pr) => [pr.id, pr]));
  const items: PrHistoryItem[] = [];

  for (const [pid, overlap] of overlapByPrId) {
    const pr = prById.get(pid);
    if (!pr) continue;

    // `updatedAt` is the best available proxy for `merged_at`; fall back to an
    // empty string when the column is null so the contract string field is valid.
    const mergedAt = pr.updatedAt?.toISOString() ?? '';

    const item = PrHistoryItem.parse({
      pr_number: pr.number,
      title: pr.title,
      merged_at: mergedAt,
      author: pr.author,
      files_overlap: overlap,
      notes: `Touched ${overlap.length} file${overlap.length === 1 ? '' : 's'} also changed by the current PR.`,
    });

    items.push(item);

    if (items.length >= MAX_HISTORY_ITEMS) break;
  }

  return PrHistory.parse({ history: items });
}
