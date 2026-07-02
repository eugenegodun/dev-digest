import { SmartDiff } from '@devdigest/shared';
import type { SmartDiffFile, SmartDiffGroup, ProposedSplit } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { classifyFile } from './classify.js';
import { SPLIT_TOO_BIG_LINES, ROOT_BUCKET } from './constants.js';

/**
 * Derive a short, deterministic pseudocode summary from a set of finding
 * rationales. Takes the first sentence of each rationale (up to a few
 * findings), joining with "; " and truncating to 200 chars.
 *
 * Returns null when rationales is empty. Treats rationale text as untrusted
 * data; no HTML or interpolation — rendered only via JSX auto-escaping on
 * the client.
 */
function buildPseudocodeSummary(rationales: string[]): string | null {
  if (rationales.length === 0) return null;
  const sentences = rationales.map((r) => {
    const firstSentence = r.split(/[.!?\n]/)[0] ?? r;
    return firstSentence.trim();
  });
  const joined = sentences.filter(Boolean).join('; ');
  return joined.length > 200 ? joined.slice(0, 197) + '...' : joined || null;
}

/**
 * Return the top-level directory of a normalised forward-slash path, or the
 * ROOT_BUCKET constant when the file lives directly at the repo root.
 */
function topLevelDir(normalisedPath: string): string {
  const slashIdx = normalisedPath.indexOf('/');
  return slashIdx === -1 ? ROOT_BUCKET : normalisedPath.slice(0, slashIdx);
}

/**
 * Build a deterministic SmartDiff for the given pull request.
 *
 * Compute-on-read: no LLM call, no cache, no DB write.
 *
 * Steps:
 *   1. Resolve the pull (workspace-scoped) — 404 if absent or foreign-workspace.
 *   2. Load PR files from pr_files.
 *   3. Load the latest review findings (newest review = index 0); absent before
 *      the first "Run Review".
 *   4. Classify each file; derive finding_lines and pseudocode_summary.
 *   5. Emit exactly three groups in fixed order: core → wiring → boilerplate.
 *   6. Compute split_suggestion from core files only.
 *   7. Validate + return via SmartDiff.parse().
 */
export async function buildSmartDiff(
  container: Container,
  workspaceId: string,
  prId: string,
): Promise<SmartDiff> {
  // 1. Resolve pull (workspace-scoped); 404 for missing or foreign-workspace PR.
  const pull = await container.reviewRepo.getPull(workspaceId, prId);
  if (!pull) throw new NotFoundError('Pull request not found');

  // 2. Load files attached to this PR (via the ReviewRepository facade — the
  //    single DB seam for the review domain).
  const prFiles = await container.reviewRepo.getPrFiles(prId);

  // 3. Latest review findings (may be empty when no review has been run yet).
  const reviews = await container.reviewRepo.reviewsForPull(prId);
  const latestFindings = reviews[0]?.findings ?? [];

  // Pre-index findings by file path for O(1) lookup per file.
  const findingsByFile = new Map<string, typeof latestFindings>();
  for (const finding of latestFindings) {
    const list = findingsByFile.get(finding.file);
    if (list) {
      list.push(finding);
    } else {
      findingsByFile.set(finding.file, [finding]);
    }
  }

  // 4. Classify each file; build SmartDiffFile entries.
  const coreFiles: SmartDiffFile[] = [];
  const wiringFiles: SmartDiffFile[] = [];
  const boilerplateFiles: SmartDiffFile[] = [];

  for (const prFile of prFiles) {
    const role = classifyFile(prFile.path);
    const fileFindings = findingsByFile.get(prFile.path) ?? [];

    const findingLines = fileFindings.map((f) => f.startLine);
    const rationales = fileFindings.map((f) => f.rationale);
    const pseudocodeSummary = buildPseudocodeSummary(rationales);

    const entry: SmartDiffFile = {
      path: prFile.path,
      additions: prFile.additions,
      deletions: prFile.deletions,
      finding_lines: findingLines,
      pseudocode_summary: pseudocodeSummary,
    };

    if (role === 'core') coreFiles.push(entry);
    else if (role === 'wiring') wiringFiles.push(entry);
    else boilerplateFiles.push(entry);
  }

  // 5. Exactly three groups in fixed order.
  const groups: SmartDiffGroup[] = [
    { role: 'core', files: coreFiles },
    { role: 'wiring', files: wiringFiles },
    { role: 'boilerplate', files: boilerplateFiles },
  ];

  // 6. Split suggestion: total_lines over core files only.
  const totalLines = coreFiles.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const tooBig = totalLines > SPLIT_TOO_BIG_LINES;

  // Group core files by top-level directory for proposed_splits.
  const splitMap = new Map<string, string[]>();
  for (const f of coreFiles) {
    const dir = topLevelDir(f.path.replace(/\\/g, '/'));
    const bucket = splitMap.get(dir);
    if (bucket) {
      bucket.push(f.path);
    } else {
      splitMap.set(dir, [f.path]);
    }
  }
  const proposedSplits: ProposedSplit[] = Array.from(splitMap.entries()).map(([name, files]) => ({
    name,
    files,
  }));

  // 7. Validate with the canonical schema gate and return.
  return SmartDiff.parse({
    groups,
    split_suggestion: {
      too_big: tooBig,
      total_lines: totalLines,
      proposed_splits: proposedSplits,
    },
  });
}
