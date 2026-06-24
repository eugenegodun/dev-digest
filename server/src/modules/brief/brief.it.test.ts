import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import { MockLLMProvider, MockGitClient, MockGitHubClient } from '../../adapters/mocks.js';
import * as t from '../../db/schema.js';
import type { Intent, Risks, PrBrief } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[brief] Docker not available — skipping integration tests.');
}

// ---- Fixtures ----------------------------------------------------------------

const INTENT_FIXTURE: Intent = {
  intent: 'Add rate limiting to public API endpoints to prevent abuse.',
  in_scope: ['rate limiting middleware', 'public API routes'],
  out_of_scope: ['authentication logic', 'database schema'],
};

const RISKS_FIXTURE: Risks = {
  risks: [
    {
      kind: 'correctness',
      title: 'Limiter may not cover all routes',
      explanation: 'Rate limiting is applied only to /api/v1 but other paths are unguarded.',
      severity: 'medium',
      file_refs: ['src/middleware/ratelimit.ts'],
    },
  ],
};

/**
 * Number of LLM structured calls issued per brief build.
 * Phase 2: intent (1) + risks (1) = 2 calls per build.
 */
const LLM_CALLS_PER_BUILD = 2;

const HEAD_SHA_V1 = 'sha-v1-aabbccdd';
const HEAD_SHA_V2 = 'sha-v2-11223344';

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

// ---- DB seed helpers ---------------------------------------------------------

let repoSeq = 0;

async function setupRepoAndPr(
  db: PgFixture['handle']['db'],
  workspaceId: string,
  headSha: string = HEAD_SHA_V1,
) {
  const name = `brief-test-repo-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();

  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: 101,
      title: 'Add rate limiting to public API',
      author: 'alice',
      branch: 'feat/rate-limit',
      base: 'main',
      headSha,
      additions: 10,
      deletions: 2,
      filesCount: 2,
      status: 'needs_review',
      body: 'This PR adds rate limiting. Closes #99.',
    })
    .returning();

  // Persist patch so diffFromPrFiles (fallback) works
  await db.insert(t.prFiles).values({
    prId: pr!.id,
    path: 'src/middleware/ratelimit.ts',
    additions: 10,
    deletions: 2,
    patch:
      '@@ -1,3 +1,10 @@\n+import rateLimit from "express-rate-limit";\n+export const limiter = rateLimit({ max: 100 });',
  });

  return { repo: repo!, pr: pr! };
}

// ---- Integration tests -------------------------------------------------------

d('GET /pulls/:id/brief (Testcontainers pg)', () => {
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

  /**
   * Build the app with a mock LLM returning INTENT_FIXTURE for 'Intent' and
   * RISKS_FIXTURE for 'Risks', a mock git returning a deterministic diff, and
   * a mock GitHub that returns no linked_issue (so intent/risks fall back to
   * title+body+diff).
   *
   * Phase 2: each brief build issues 2 LLM structured calls (intent + risks).
   * Blast and history are derived from DB/repo-intel; with no indexed repo and
   * no merged PRs in the test seed, both degrade to empty-but-valid.
   */
  function makeApp(llmCallCounts?: { count: number }) {
    // MockLLMProvider id is narrowed to 'openai'|'anthropic'; inject it under
    // 'openrouter' in overrides so the default feature models (openrouter)
    // resolve to the mock rather than requiring a real API key.
    const llmProvider = new MockLLMProvider('openai', {
      structuredBySchema: {
        Intent: INTENT_FIXTURE,
        Risks: RISKS_FIXTURE,
      },
    });

    // Wrap to track calls if a counter object is supplied
    if (llmCallCounts) {
      const original = llmProvider.completeStructured.bind(llmProvider);
      llmProvider.completeStructured = async (req) => {
        llmCallCounts.count++;
        return original(req);
      };
    }

    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        // Provide the mock under all providers so feature models that default
        // to 'openai' (risk_brief) or 'openrouter' (review_intent) both resolve
        // to the same mock without requiring real API keys.
        llm: { openrouter: llmProvider, openai: llmProvider },
      },
    });
  }

  // (1) First GET builds and persists; returns valid PrBrief with all sections populated
  it('first GET builds the brief, persists it, and returns valid PrBrief', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const app = await makeApp();

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<PrBrief>();

    // Intent is populated from the LLM mock
    expect(body.intent).toEqual(INTENT_FIXTURE);

    // Risks are populated from the LLM mock (Phase 2)
    expect(body.risks).toEqual(RISKS_FIXTURE);
    expect(body.risks.risks).toHaveLength(1);
    expect(body.risks.risks[0]!.severity).toBe('medium');

    // Blast degrades to empty-but-valid (no indexed repo, no clone path in MockGitClient)
    expect(Array.isArray(body.blast.changed_symbols)).toBe(true);
    expect(Array.isArray(body.blast.downstream)).toBe(true);
    expect(typeof body.blast.summary).toBe('string');

    // History degrades to empty-but-valid (no merged PRs seeded for this repo)
    expect(Array.isArray(body.history.history)).toBe(true);

    // Row persisted in the DB
    const rows = await pg.handle.db
      .select()
      .from(t.prBrief)
      .where(eq(t.prBrief.prId, pr.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.headSha).toBe(HEAD_SHA_V1);
  });

  // (2) Second GET with the same head_sha is served from cache (LLM not called again)
  it('second GET with same head_sha is a cache hit (LLM not called again)', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    const llmCalls = { count: 0 };

    // First request — builds the brief (Phase 2: intent + risks = LLM_CALLS_PER_BUILD calls)
    const app1 = await makeApp(llmCalls);
    const res1 = await app1.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    await app1.close();
    expect(res1.statusCode).toBe(200);
    expect(llmCalls.count).toBe(LLM_CALLS_PER_BUILD);

    // Second request (same app instance not needed; same DB)
    const app2 = await makeApp(llmCalls);
    const res2 = await app2.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    await app2.close();

    expect(res2.statusCode).toBe(200);
    // LLM must NOT have been called a second time (cache hit)
    expect(llmCalls.count).toBe(LLM_CALLS_PER_BUILD);
    // Response is structurally identical
    expect(res2.json<PrBrief>().intent).toEqual(INTENT_FIXTURE);
    expect(res2.json<PrBrief>().risks).toEqual(RISKS_FIXTURE);
  });

  // (3) Bumping pull.headSha triggers a rebuild
  it('bumping pull.headSha triggers a rebuild (LLM called again)', async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId, HEAD_SHA_V1);

    const llmCalls = { count: 0 };

    // First build (Phase 2: intent + risks = LLM_CALLS_PER_BUILD calls)
    const app1 = await makeApp(llmCalls);
    await app1.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    await app1.close();
    expect(llmCalls.count).toBe(LLM_CALLS_PER_BUILD);

    // Simulate a force-push / new commit by updating the PR's head_sha
    await pg.handle.db
      .update(t.pullRequests)
      .set({ headSha: HEAD_SHA_V2 })
      .where(eq(t.pullRequests.id, pr.id));

    // Second request after head advanced — must trigger a full rebuild
    const app2 = await makeApp(llmCalls);
    const res2 = await app2.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    await app2.close();

    expect(res2.statusCode).toBe(200);
    // LLM was called again (LLM_CALLS_PER_BUILD more calls) because head_sha changed
    expect(llmCalls.count).toBe(LLM_CALLS_PER_BUILD * 2);

    // Cached row now has the new head_sha
    const [row] = await pg.handle.db
      .select()
      .from(t.prBrief)
      .where(eq(t.prBrief.prId, pr.id));
    expect(row!.headSha).toBe(HEAD_SHA_V2);
  });

  // (4) Invalid :id → 422
  it('invalid :id (not a UUID) returns 422', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/pulls/not-a-uuid/brief' });
    await app.close();
    expect(res.statusCode).toBe(422);
  });

  // (5) Unknown PR → 404
  it('unknown PR id returns 404', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/pulls/00000000-0000-0000-0000-000000000000/brief',
    });
    await app.close();
    expect(res.statusCode).toBe(404);
  });
});
