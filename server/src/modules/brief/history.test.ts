import { describe, it, expect, vi } from 'vitest';
import { PrHistory as PrHistorySchema } from '../../vendor/shared/contracts/brief.js';
import type { Db } from '../../db/client.js';
import { deriveHistory, type DeriveHistoryInput } from './history.js';

/**
 * Hermetic unit tests for `deriveHistory`.
 *
 * The Drizzle DB is mocked at the query level (no Docker / testcontainers).
 * Two Drizzle query shapes are issued by `deriveHistory`:
 *   1. select merged PRs from pullRequests
 *   2. select overlapping pr_files rows
 * The mock sequences the responses via a call-count counter.
 */

// ---- Fixtures ---------------------------------------------------------------

/** A stable repo/PR identity for all tests */
const REPO_ID = 'repo-uuid-aaaa';
const CURRENT_PR_ID = 'pr-uuid-current';

/** Two prior merged PRs seeded in the "DB" */
const MERGED_PR_A = {
  id: 'pr-uuid-aaaa',
  number: 10,
  title: 'Refactor middleware stack',
  author: 'alice',
  updatedAt: new Date('2026-05-01T12:00:00Z'),
};
const MERGED_PR_B = {
  id: 'pr-uuid-bbbb',
  number: 20,
  title: 'Add logging to request handler',
  author: 'bob',
  updatedAt: new Date('2026-05-15T09:00:00Z'),
};

// ---- Mock helpers -----------------------------------------------------------

/**
 * Build a Drizzle DB mock whose `select` chain sequences through `responses`
 * in order of call, returning each entry as the resolved array.
 *
 * Drizzle chain used by deriveHistory:
 *   db.select({...}).from(table).where(condition)  → Promise<rows[]>
 */
function makeDbMock(responses: unknown[][]): Db {
  let callIndex = 0;
  const db = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          const response = responses[callIndex++] ?? [];
          return Promise.resolve(response);
        }),
      })),
    })),
  };
  return db as unknown as Db;
}

// ---- Tests ------------------------------------------------------------------

describe('deriveHistory', () => {
  // (a) Happy path: overlapping merged PR appears with correct files_overlap ----

  it('returns a PrHistoryItem for a merged PR that overlaps with the current PR files', async () => {
    const changedFiles = ['src/middleware/ratelimit.ts', 'src/routes/api.ts'];

    // Query 1: merged PRs in the repo → [MERGED_PR_A, MERGED_PR_B]
    // Query 2: pr_files overlap → PR_A touched 'src/middleware/ratelimit.ts', PR_B touched nothing
    const db = makeDbMock([
      [MERGED_PR_A, MERGED_PR_B],
      [
        { prId: MERGED_PR_A.id, path: 'src/middleware/ratelimit.ts' },
        { prId: MERGED_PR_A.id, path: 'src/routes/api.ts' },
      ],
    ]);

    const input: DeriveHistoryInput = {
      repoId: REPO_ID,
      prId: CURRENT_PR_ID,
      changedFiles,
    };

    const result = await deriveHistory(db, REPO_ID, input);

    // Result must pass the shared Zod schema
    expect(() => PrHistorySchema.parse(result)).not.toThrow();

    expect(result.history).toHaveLength(1);
    const item = result.history[0]!;
    expect(item.pr_number).toBe(MERGED_PR_A.number);
    expect(item.title).toBe(MERGED_PR_A.title);
    expect(item.author).toBe(MERGED_PR_A.author);
    expect(item.merged_at).toBe(MERGED_PR_A.updatedAt.toISOString());
    // Both overlapping files are captured
    expect(item.files_overlap).toContain('src/middleware/ratelimit.ts');
    expect(item.files_overlap).toContain('src/routes/api.ts');
    expect(item.notes).toContain('2 files');
  });

  // (b) Single file overlap → singular "file" in notes -------------------------

  it('uses singular "file" in notes when only one file overlaps', async () => {
    const db = makeDbMock([
      [MERGED_PR_A],
      [{ prId: MERGED_PR_A.id, path: 'src/middleware/ratelimit.ts' }],
    ]);

    const result = await deriveHistory(db, REPO_ID, {
      repoId: REPO_ID,
      prId: CURRENT_PR_ID,
      changedFiles: ['src/middleware/ratelimit.ts'],
    });

    expect(result.history).toHaveLength(1);
    expect(result.history[0]!.notes).toContain('1 file');
    expect(result.history[0]!.notes).not.toContain('1 files');
  });

  // (c) No overlap → empty history  -------------------------------------------

  it('returns { history: [] } when no merged PR overlaps with the changed files', async () => {
    const db = makeDbMock([
      [MERGED_PR_A, MERGED_PR_B],
      // No pr_files rows match the changedFiles
      [],
    ]);

    const result = await deriveHistory(db, REPO_ID, {
      repoId: REPO_ID,
      prId: CURRENT_PR_ID,
      changedFiles: ['src/new-feature/index.ts'],
    });

    expect(() => PrHistorySchema.parse(result)).not.toThrow();
    expect(result.history).toEqual([]);
  });

  // (d) No merged PRs at all → empty history -----------------------------------

  it('returns { history: [] } when there are no merged PRs in the repo', async () => {
    const db = makeDbMock([
      // First query: no merged PRs
      [],
    ]);

    const result = await deriveHistory(db, REPO_ID, {
      repoId: REPO_ID,
      prId: CURRENT_PR_ID,
      changedFiles: ['src/middleware/ratelimit.ts'],
    });

    expect(() => PrHistorySchema.parse(result)).not.toThrow();
    expect(result.history).toEqual([]);
  });

  // (e) Empty changedFiles → fast-exit with empty history ----------------------

  it('returns { history: [] } immediately when changedFiles is empty (no DB calls)', async () => {
    // DB mock will throw if called — fast-exit should skip all queries.
    const db = makeDbMock([]);

    const result = await deriveHistory(db, REPO_ID, {
      repoId: REPO_ID,
      prId: CURRENT_PR_ID,
      changedFiles: [],
    });

    expect(() => PrHistorySchema.parse(result)).not.toThrow();
    expect(result.history).toEqual([]);
    // DB should not have been queried at all
    expect((db as unknown as { select: ReturnType<typeof vi.fn> }).select).not.toHaveBeenCalled();
  });

  // (f) Multiple overlapping PRs → all appear in history -----------------------

  it('returns multiple history items when multiple merged PRs overlap', async () => {
    const db = makeDbMock([
      [MERGED_PR_A, MERGED_PR_B],
      [
        { prId: MERGED_PR_A.id, path: 'src/middleware/ratelimit.ts' },
        { prId: MERGED_PR_B.id, path: 'src/middleware/ratelimit.ts' },
      ],
    ]);

    const result = await deriveHistory(db, REPO_ID, {
      repoId: REPO_ID,
      prId: CURRENT_PR_ID,
      changedFiles: ['src/middleware/ratelimit.ts'],
    });

    expect(() => PrHistorySchema.parse(result)).not.toThrow();
    expect(result.history).toHaveLength(2);

    const prNumbers = result.history.map((h) => h.pr_number);
    expect(prNumbers).toContain(MERGED_PR_A.number);
    expect(prNumbers).toContain(MERGED_PR_B.number);
  });
});
