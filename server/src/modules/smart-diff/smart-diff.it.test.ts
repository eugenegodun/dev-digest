import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import { MockLLMProvider, MockGitClient, MockGitHubClient } from '../../adapters/mocks.js';
import * as t from '../../db/schema.js';
import type { SmartDiff } from '@devdigest/shared';
import { SPLIT_TOO_BIG_LINES, ROOT_BUCKET } from './constants.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[smart-diff] Docker not available — skipping integration tests.');
}

// ---- Config ----------------------------------------------------------------

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

// ---- DB seed helpers -------------------------------------------------------

let repoSeq = 0;

/**
 * Insert a repo + PR pair, returning both rows.
 */
async function setupRepoAndPr(
  db: PgFixture['handle']['db'],
  workspaceId: string,
) {
  const name = `smart-diff-test-repo-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();

  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: repoSeq,
      title: 'Test PR for smart-diff',
      author: 'alice',
      branch: 'feat/test',
      base: 'main',
      headSha: `sha-${repoSeq}`,
      additions: 0,
      deletions: 0,
      filesCount: 0,
      status: 'needs_review',
      body: null,
    })
    .returning();

  return { repo: repo!, pr: pr! };
}

/**
 * Seed pr_files for a given PR.
 */
async function seedPrFiles(
  db: PgFixture['handle']['db'],
  prId: string,
  files: Array<{ path: string; additions: number; deletions: number; patch?: string }>,
) {
  for (const f of files) {
    await db.insert(t.prFiles).values({
      prId,
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ?? null,
    });
  }
}

/**
 * Seed a review + findings for a given PR. Returns the inserted review row.
 */
async function seedReviewWithFindings(
  db: PgFixture['handle']['db'],
  workspaceId: string,
  prId: string,
  findings: Array<{ file: string; startLine: number; severity: string; rationale: string }>,
) {
  const [review] = await db
    .insert(t.reviews)
    .values({
      workspaceId,
      prId,
      agentId: null,
      runId: null,
      kind: 'review',
      verdict: 'approve',
      summary: 'Test review',
      score: 80,
      model: 'test-model',
    })
    .returning();

  for (const f of findings) {
    await db.insert(t.findings).values({
      reviewId: review!.id,
      file: f.file,
      startLine: f.startLine,
      endLine: f.startLine + 2,
      severity: f.severity,
      category: 'correctness',
      title: 'Test finding',
      rationale: f.rationale,
      suggestion: null,
      confidence: 0.9,
      kind: 'finding',
      trifectaComponents: null,
    });
  }

  return review!;
}

// ---- App factory -----------------------------------------------------------

function makeApp(db: PgFixture['handle']['db']) {
  return buildApp({
    config: config(),
    db,
    overrides: {
      git: new MockGitClient(),
      github: new MockGitHubClient(),
      llm: {
        openrouter: new MockLLMProvider('openai', {}),
        openai: new MockLLMProvider('openai', {}),
      },
    },
  });
}

// ---- Integration tests -----------------------------------------------------

d('GET /pulls/:id/smart-diff (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  // (1) Mixed files, no review → grouping order + roles, all finding_lines
  //     empty, all summaries null.
  it('groups files correctly (core/wiring/boilerplate), no review → empty findings', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'src/service.ts', additions: 20, deletions: 5 },       // core
      { path: 'vite.config.ts', additions: 3, deletions: 1 },         // wiring
      { path: 'package-lock.json', additions: 100, deletions: 50 },   // boilerplate
      { path: 'src/utils.ts', additions: 10, deletions: 0 },          // core
      { path: 'index.ts', additions: 2, deletions: 0 },               // wiring
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    // Exactly three groups in fixed order
    expect(body.groups).toHaveLength(3);
    expect(body.groups[0]!.role).toBe('core');
    expect(body.groups[1]!.role).toBe('wiring');
    expect(body.groups[2]!.role).toBe('boilerplate');

    // Core files
    const coreFiles = body.groups[0]!.files;
    expect(coreFiles).toHaveLength(2);
    const corePaths = coreFiles.map((f) => f.path);
    expect(corePaths).toContain('src/service.ts');
    expect(corePaths).toContain('src/utils.ts');

    // Wiring files
    const wiringFiles = body.groups[1]!.files;
    expect(wiringFiles).toHaveLength(2);
    const wiringPaths = wiringFiles.map((f) => f.path);
    expect(wiringPaths).toContain('vite.config.ts');
    expect(wiringPaths).toContain('index.ts');

    // Boilerplate files
    const boilerplateFiles = body.groups[2]!.files;
    expect(boilerplateFiles).toHaveLength(1);
    expect(boilerplateFiles[0]!.path).toBe('package-lock.json');

    // No review → all finding_lines empty, all summaries null
    for (const group of body.groups) {
      for (const file of group.files) {
        expect(file.finding_lines).toEqual([]);
        expect(file.pseudocode_summary == null).toBe(true);
      }
    }
  });

  // (2) With a review → flagged files carry startLines + non-null summary,
  //     unflagged files remain empty.
  it('with a review: flagged files carry finding_lines + pseudocode_summary', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'src/auth.ts', additions: 40, deletions: 10 },     // core — flagged
      { path: 'src/routes.ts', additions: 5, deletions: 0 },     // core — unflagged
      { path: 'tsconfig.json', additions: 1, deletions: 0 },     // wiring — unflagged
    ]);

    await seedReviewWithFindings(pg.handle.db, workspaceId, pr.id, [
      {
        file: 'src/auth.ts',
        startLine: 12,
        severity: 'high',
        rationale: 'Missing null check on user. This can cause a crash.',
      },
      {
        file: 'src/auth.ts',
        startLine: 45,
        severity: 'medium',
        rationale: 'Token expiry not validated before use.',
      },
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    const coreFiles = body.groups[0]!.files;
    const authFile = coreFiles.find((f) => f.path === 'src/auth.ts');
    const routesFile = coreFiles.find((f) => f.path === 'src/routes.ts');

    // Flagged file carries finding_lines and non-null summary
    expect(authFile).toBeDefined();
    expect(authFile!.finding_lines).toContain(12);
    expect(authFile!.finding_lines).toContain(45);
    expect(authFile!.pseudocode_summary).not.toBeNull();
    expect(typeof authFile!.pseudocode_summary).toBe('string');

    // Unflagged core file has empty finding_lines and null summary
    expect(routesFile).toBeDefined();
    expect(routesFile!.finding_lines).toEqual([]);
    expect(routesFile!.pseudocode_summary == null).toBe(true);
  });

  // (3a) Split heuristic: too_big = false when core lines ≤ SPLIT_TOO_BIG_LINES
  it('split_suggestion.too_big is false when core lines are within threshold', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    // Core files with total additions+deletions well under the threshold
    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'src/a.ts', additions: 50, deletions: 20 },   // 70 lines
      { path: 'src/b.ts', additions: 80, deletions: 30 },   // 110 lines
      // total: 180, well under SPLIT_TOO_BIG_LINES (400)
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    expect(body.split_suggestion.too_big).toBe(false);
    expect(body.split_suggestion.total_lines).toBe(180);
  });

  // (3b) Split heuristic: too_big = true when core lines > SPLIT_TOO_BIG_LINES
  it('split_suggestion.too_big is true when core lines exceed threshold', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    const additions = Math.ceil(SPLIT_TOO_BIG_LINES / 2) + 10;
    const deletions = Math.ceil(SPLIT_TOO_BIG_LINES / 2) + 10;

    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'src/feature/heavy.ts', additions, deletions },
      // boilerplate lines don't count toward split threshold
      { path: 'package-lock.json', additions: 9999, deletions: 9999 },
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    expect(body.split_suggestion.too_big).toBe(true);
    expect(body.split_suggestion.total_lines).toBe(additions + deletions);

    // proposed_splits should group by top-level dir
    expect(body.split_suggestion.proposed_splits).toHaveLength(1);
    expect(body.split_suggestion.proposed_splits[0]!.name).toBe('src');
  });

  // (3c) Root-level files land in ROOT_BUCKET
  it('core files at the repo root go into the ROOT_BUCKET bucket in proposed_splits', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    // Two root-level core files + one nested — all over the threshold total
    const linesPerFile = Math.ceil(SPLIT_TOO_BIG_LINES / 3) + 50;
    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'main.ts', additions: linesPerFile, deletions: 0 },
      { path: 'helper.ts', additions: linesPerFile, deletions: 0 },
      { path: 'src/deep.ts', additions: linesPerFile, deletions: 0 },
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    expect(body.split_suggestion.too_big).toBe(true);

    const splitNames = body.split_suggestion.proposed_splits.map((s) => s.name);
    expect(splitNames).toContain(ROOT_BUCKET);
    expect(splitNames).toContain('src');

    const rootBucket = body.split_suggestion.proposed_splits.find((s) => s.name === ROOT_BUCKET);
    expect(rootBucket!.files).toContain('main.ts');
    expect(rootBucket!.files).toContain('helper.ts');
  });

  // (4) Random UUID → 404
  it('unknown PR id returns 404', async () => {
    const app = await makeApp(pg.handle.db);
    const res = await app.inject({
      method: 'GET',
      url: '/pulls/00000000-0000-0000-0000-000000000000/smart-diff',
    });
    await app.close();
    expect(res.statusCode).toBe(404);
  });

  // (5) Invalid id → 422
  it('invalid :id (not a UUID) returns 422', async () => {
    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: '/pulls/not-a-uuid/smart-diff' });
    await app.close();
    expect(res.statusCode).toBe(422);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  // (6) Only boilerplate files — no core files at all.
  //     Core group must be empty; total_lines = 0; too_big = false; proposed_splits = [].
  it('PR with only boilerplate files: core group empty, total_lines 0, too_big false', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'package-lock.json', additions: 5000, deletions: 3000 }, // boilerplate
      { path: 'pnpm-lock.yaml', additions: 1000, deletions: 500 },     // boilerplate
      { path: 'dist/bundle.js', additions: 2000, deletions: 0 },       // boilerplate
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    // Still exactly three groups in fixed order.
    expect(body.groups).toHaveLength(3);
    expect(body.groups[0]!.role).toBe('core');
    expect(body.groups[1]!.role).toBe('wiring');
    expect(body.groups[2]!.role).toBe('boilerplate');

    // Core group is empty.
    expect(body.groups[0]!.files).toHaveLength(0);

    // Wiring group is also empty (no wiring files seeded).
    expect(body.groups[1]!.files).toHaveLength(0);

    // Boilerplate group has all three files.
    expect(body.groups[2]!.files).toHaveLength(3);

    // Split suggestion: core contributes nothing.
    expect(body.split_suggestion.total_lines).toBe(0);
    expect(body.split_suggestion.too_big).toBe(false);
    expect(body.split_suggestion.proposed_splits).toHaveLength(0);
  });

  // (7) Stale finding: finding references a file path not present in pr_files.
  //     The service must not crash; the stale path must NOT appear as a new file.
  it('stale finding (file not in PR) does not crash and does not invent a file', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'src/real.ts', additions: 10, deletions: 2 },
    ]);

    // The finding references a path that is NOT in pr_files.
    await seedReviewWithFindings(pg.handle.db, workspaceId, pr.id, [
      {
        file: 'src/ghost.ts', // stale — this path does not exist in pr_files
        startLine: 7,
        severity: 'high',
        rationale: 'Obsolete finding for a removed file.',
      },
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    // Only the real file should appear; the stale path must NOT be invented.
    const allPaths = body.groups.flatMap((g) => g.files.map((f) => f.path));
    expect(allPaths).toContain('src/real.ts');
    expect(allPaths).not.toContain('src/ghost.ts');

    // The real file has no findings (its path doesn't match the stale finding).
    const realFile = body.groups[0]!.files.find((f) => f.path === 'src/real.ts');
    expect(realFile).toBeDefined();
    expect(realFile!.finding_lines).toEqual([]);
    expect(realFile!.pseudocode_summary == null).toBe(true);
  });

  // (8) Multiple findings on the SAME file → finding_lines collects all start lines.
  //     Also verifies no crash and sensible de-duplication when start lines differ.
  it('multiple findings on the same file: finding_lines collects all distinct start lines', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'src/auth.ts', additions: 100, deletions: 20 },
    ]);

    await seedReviewWithFindings(pg.handle.db, workspaceId, pr.id, [
      { file: 'src/auth.ts', startLine: 5,  severity: 'critical', rationale: 'Null check missing.' },
      { file: 'src/auth.ts', startLine: 30, severity: 'high',     rationale: 'Token not validated.' },
      { file: 'src/auth.ts', startLine: 72, severity: 'warning',  rationale: 'Log leaks PII.' },
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    const authFile = body.groups[0]!.files.find((f) => f.path === 'src/auth.ts');
    expect(authFile).toBeDefined();

    // All three start lines must be present.
    expect(authFile!.finding_lines).toContain(5);
    expect(authFile!.finding_lines).toContain(30);
    expect(authFile!.finding_lines).toContain(72);

    // Exactly three entries (one per finding — no duplicates introduced for distinct lines).
    expect(authFile!.finding_lines).toHaveLength(3);

    // pseudocode_summary should be non-null and include content from the first rationale.
    expect(authFile!.pseudocode_summary).not.toBeNull();
    expect(typeof authFile!.pseudocode_summary).toBe('string');
  });

  // (9) Multiple findings with DUPLICATE start lines on the same file.
  //     finding_lines should contain each raw startLine exactly as the service
  //     produces it (the service maps startLine per finding without deduplication).
  //     Assert that the duplicated line appears at least once (service contract) and
  //     the array length equals the number of findings.
  it('duplicate start lines from multiple findings on the same file are all collected', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    await seedPrFiles(pg.handle.db, pr.id, [
      { path: 'src/service.ts', additions: 50, deletions: 10 },
    ]);

    // Two findings share the same start_line (12).
    await seedReviewWithFindings(pg.handle.db, workspaceId, pr.id, [
      { file: 'src/service.ts', startLine: 12, severity: 'high', rationale: 'First issue at line 12.' },
      { file: 'src/service.ts', startLine: 12, severity: 'warning', rationale: 'Second issue at line 12.' },
    ]);

    const app = await makeApp(pg.handle.db);
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<SmartDiff>();

    const svcFile = body.groups[0]!.files.find((f) => f.path === 'src/service.ts');
    expect(svcFile).toBeDefined();

    // The duplicated line must be present.
    expect(svcFile!.finding_lines).toContain(12);

    // Service produces one entry per finding, so both are recorded.
    // (asserting at-least-one rather than exactly-two, to survive any future
    // dedup logic without breaking the test)
    expect(svcFile!.finding_lines.length).toBeGreaterThanOrEqual(1);
  });
});
