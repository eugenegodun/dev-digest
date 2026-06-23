import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * Token-budget guard: cap the number of spec chunks and total character count
 * fetched from the DB so a large spec doesn't blow the LLM's context window.
 * These values are deliberately conservative for a cheap/fast model.
 */
const MAX_SPEC_ROWS = 10;
const MAX_SPEC_CHARS = 8_000;

export interface SpecChunk {
  path: string;
  content: string;
}

export interface GetSpecChunksOpts {
  /** Override the row cap (default: MAX_SPEC_ROWS). */
  maxRows?: number;
  /** Override the total-char budget (default: MAX_SPEC_CHARS). */
  maxChars?: number;
}

/**
 * Fetch spec chunks for a workspace + repo from `code_chunks`
 * where `source = 'spec'`.
 *
 * Results are capped to `maxRows` rows and a `maxChars` total character budget
 * to avoid flooding the LLM with a large spec corpus. The cap is applied in
 * database row order (insertion order, effectively by path + id) — callers that
 * need deterministic ordering should supply an explicit ORDER BY via a future
 * extension; for intent derivation the row order is sufficient.
 */
export async function getSpecChunks(
  db: Db,
  workspaceId: string,
  repoId: string,
  opts?: GetSpecChunksOpts,
): Promise<SpecChunk[]> {
  const maxRows = opts?.maxRows ?? MAX_SPEC_ROWS;
  const maxChars = opts?.maxChars ?? MAX_SPEC_CHARS;

  const rows = await db
    .select({ path: t.codeChunks.path, content: t.codeChunks.content })
    .from(t.codeChunks)
    .where(
      and(
        eq(t.codeChunks.workspaceId, workspaceId),
        eq(t.codeChunks.repoId, repoId),
        eq(t.codeChunks.source, 'spec'),
      ),
    )
    .limit(maxRows);

  // Apply total-chars budget: take chunks in order until the budget is spent.
  const result: SpecChunk[] = [];
  let totalChars = 0;
  for (const row of rows) {
    if (totalChars + row.content.length > maxChars) break;
    result.push({ path: row.path, content: row.content });
    totalChars += row.content.length;
  }
  return result;
}
