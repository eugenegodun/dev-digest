import { PrBrief } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { loadDiff } from '../reviews/diff-loader.js';
import { deriveIntent } from './intent.js';
import { getSpecChunks } from './spec-reader.js';
import { getBrief, upsertBrief } from './repository.js';

/**
 * Build or return a cached `PrBrief` for the given pull request.
 *
 * Cache semantics: a cached brief is returned as-is iff `cached.headSha ===
 * pull.headSha` (i.e. the HEAD has not moved since we last built). Any
 * force-push or new commit invalidates the cache.
 *
 * Phase 1: only `intent` is populated. The other three sections ship
 * empty-but-valid objects so `PrBrief.parse(json)` always succeeds and the
 * client card can render incrementally (empty sections are hidden, not broken).
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
  //    fetch spec chunks, and derive intent.
  const diff = await loadDiff(container, container.reviewRepo, workspaceId, pull, repoRow);

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
    // Non-fatal: fall back to title+body+diff for intent derivation.
    linkedIssueBody = undefined;
  }

  const specChunks = await getSpecChunks(db, workspaceId, pull.repoId);

  const intent = await deriveIntent(container, workspaceId, {
    pull: { number: pull.number, title: pull.title, body: pull.body },
    repo: repoRow.fullName,
    diff,
    linkedIssueBody,
    specChunks,
  });

  // 4. Compose a full, schema-valid PrBrief with empty-but-valid sections for
  //    the parts not yet populated in Phase 1. This keeps the contract stable
  //    so Phase 2 can add `blast`, `risks`, and `history` without a schema
  //    change (see §7 of the plan: "Partial PrBrief" decision).
  const briefJson = PrBrief.parse({
    intent,
    blast: { changed_symbols: [], downstream: [], summary: '' },
    risks: { risks: [] },
    history: { history: [] },
  });

  await upsertBrief(db, prId, briefJson, pull.headSha);
  return briefJson;
}
