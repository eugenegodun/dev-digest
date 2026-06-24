import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PrBrief } from '@devdigest/shared';

/**
 * Data-access layer for the `pr_brief` table.
 *
 * Pattern modeled on `upsertIntent` in
 * `modules/reviews/repository/pull.repo.ts:49`.
 */

export interface BriefRow {
  json: PrBrief;
  headSha: string | null;
}

/**
 * Read the cached `pr_brief` row for a pull request.
 * Returns `undefined` when no brief has been built yet.
 */
export async function getBrief(db: Db, prId: string): Promise<BriefRow | undefined> {
  const [row] = await db.select().from(t.prBrief).where(eq(t.prBrief.prId, prId));
  if (!row) return undefined;
  return {
    json: row.json as PrBrief,
    headSha: row.headSha,
  };
}

/**
 * Persist (or overwrite) the cached brief for a pull request.
 *
 * Uses `onConflictDoUpdate` on the `pr_id` primary key — safe for
 * concurrent requests building a brief for the same PR (last write wins,
 * which is fine since the result is deterministic per head_sha).
 */
export async function upsertBrief(
  db: Db,
  prId: string,
  json: PrBrief,
  headSha: string | null,
): Promise<void> {
  await db
    .insert(t.prBrief)
    .values({ prId, json, headSha })
    .onConflictDoUpdate({
      target: t.prBrief.prId,
      set: { json, headSha },
    });
}
