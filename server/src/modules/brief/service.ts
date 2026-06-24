import { PrBrief } from '@devdigest/shared';
import type { BlastRadius, Risks, PrHistory } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { loadDiff } from '../reviews/diff-loader.js';
import { deriveIntent } from './intent.js';
import { deriveRisks } from './risks.js';
import { deriveHistory } from './history.js';
import { mapBlastRadius } from './blast-mapper.js';
import { getSpecChunks } from './spec-reader.js';
import { getBrief, upsertBrief } from './repository.js';

// Empty-but-valid fallbacks — used when a section's derivation fails.
const EMPTY_BLAST: BlastRadius = { changed_symbols: [], downstream: [], summary: '' };
const EMPTY_RISKS: Risks = { risks: [] };
const EMPTY_HISTORY: PrHistory = { history: [] };

/**
 * Build or return a cached `PrBrief` for the given pull request.
 *
 * Cache semantics: a cached brief is returned as-is iff `cached.headSha ===
 * pull.headSha` (i.e. the HEAD has not moved since we last built). Any
 * force-push or new commit invalidates the cache.
 *
 * Phase 2: all four sections are populated. `intent` is the only must-have;
 * `blast`, `risks`, and `history` each degrade to their empty-but-valid
 * fallback on any failure (LLM error, unindexed repo, missing data) so the
 * whole brief never fails because of a non-critical section.
 *
 * `blast`, `risks`, and `history` run concurrently via `Promise.allSettled`
 * to minimise total latency; `intent` is awaited first because the linked-
 * issue lookup it shares with `risks` is already resolved at that point.
 */
export async function getOrBuildBrief(
  container: Container,
  workspaceId: string,
  prId: string,
): Promise<PrBrief> {
  const db = container.db;

  // 1. Resolve the pull (workspace-scoped) — 404 if absent.
  const pull = await container.reviewRepo.getPull(workspaceId, prId);
  if (!pull) throw new NotFoundError('Pull request not found');

  // Resolve the repo row (needed for diff loading and spec lookup).
  const repoRow = await container.reviewRepo.getRepo(pull.repoId);
  if (!repoRow) throw new NotFoundError('Repository not found');

  // 2. Cache hit: return the stored brief when head_sha hasn't moved.
  const cached = await getBrief(db, prId);
  if (cached && cached.headSha === pull.headSha) {
    return cached.json;
  }

  // 3. Build: load the diff, fetch the linked-issue body (best-effort),
  //    and fetch spec chunks — shared inputs for intent and risks.
  const diff = await loadDiff(container, container.reviewRepo, workspaceId, pull, repoRow);

  // Compute the list of changed file paths once; used by blast and history.
  const changedFiles = diff.files.map((f) => f.path);

  // Fetch the linked-issue body live via GitHub (best-effort — swallow errors
  // so a missing token or a 404 never fails the whole brief build).
  let linkedIssueBody: string | undefined;
  try {
    const gh = await container.github();
    const detail = await gh.getPullRequest(
      { owner: repoRow.owner, name: repoRow.name },
      pull.number,
    );
    linkedIssueBody = detail.linked_issue?.body ?? undefined;
  } catch {
    // Non-fatal: fall back to title+body+diff for intent and risk derivation.
    linkedIssueBody = undefined;
  }

  const specChunks = await getSpecChunks(db, workspaceId, pull.repoId);

  // 4. Derive intent (must-have; propagates errors to the caller).
  const intent = await deriveIntent(container, workspaceId, {
    pull: { number: pull.number, title: pull.title, body: pull.body },
    repo: repoRow.fullName,
    diff,
    linkedIssueBody,
    specChunks,
  });

  // 5. Derive blast, risks, history concurrently. Each section degrades
  //    independently: a failure produces the section's empty-but-valid value
  //    and never propagates to the other sections or to the caller.
  const [blastResult, risksResult, historyResult] = await Promise.allSettled([
    // Blast radius via the repo-intel facade (degrades to empty on unindexed repos).
    (async (): Promise<BlastRadius> => {
      const blastRaw = await container.repoIntel.getBlastRadius(pull.repoId, changedFiles);
      return mapBlastRadius(blastRaw);
    })(),

    // Risk assessment via LLM (degrades to empty on LLM error or missing key).
    deriveRisks(container, workspaceId, {
      pull: { number: pull.number, title: pull.title, body: pull.body },
      repo: repoRow.fullName,
      diff,
      linkedIssueBody,
      specChunks,
    }),

    // PR history via DB (degrades to empty when no merged PRs exist or changedFiles is empty).
    deriveHistory(db, pull.repoId, {
      repoId: pull.repoId,
      prId,
      changedFiles,
    }),
  ]);

  const blast = blastResult.status === 'fulfilled' ? blastResult.value : EMPTY_BLAST;
  const risks = risksResult.status === 'fulfilled' ? risksResult.value : EMPTY_RISKS;
  const history = historyResult.status === 'fulfilled' ? historyResult.value : EMPTY_HISTORY;

  // 6. Compose a full, schema-valid PrBrief. `PrBrief.parse` is the
  //    canonical validation gate — it will throw on any shape violation.
  const briefJson = PrBrief.parse({ intent, blast, risks, history });

  await upsertBrief(db, prId, briefJson, pull.headSha);
  return briefJson;
}
