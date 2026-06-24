import 'dotenv/config';
import { createDb, type Db } from './client.js';
import * as t from './schema.js';
import { eq, and } from 'drizzle-orm';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
  UNCOVERED_BRANCH_RUBRIC,
  CORNER_CASE_CHECKLIST,
  OVER_MOCKING_GATE,
  FLAKY_TEST_SMELLS,
  API_CONTRACT_BREAKING_CHANGE,
  TEST_QUALITY_REVIEWER_PROMPT,
  API_CONTRACT_REVIEWER_PROMPT,
} from './seed-prompts.js';

/** Default provider/model for the built-in reviewer agents. */
const DEFAULT_PROVIDER = 'openrouter' as const;
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

/**
 * Seed the starter's demo data. Idempotent: re-running upserts the default
 * workspace/user and the demo fixtures.
 *
 * Seeds: default workspace + system user + membership, default settings,
 * demo repo (acme/payments-api), PR #482 with files/commits, a sample review
 * with a few findings, and the three built-in agents (General + Security +
 * Performance), all on the default openrouter/deepseek-v4-flash provider+model.
 *
 * Course lessons populate the other tables (skills, conventions, memory, eval,
 * …) once their features are built — they start empty here.
 */

export const DEFAULT_WORKSPACE_NAME = 'default';
export const SYSTEM_USER_EMAIL = 'you@local';

export async function seed(db: Db): Promise<{ workspaceId: string; userId: string }> {
  // ---- workspace + user (no-auth defaults) ----
  let [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    [ws] = await db
      .insert(t.workspaces)
      .values({ name: DEFAULT_WORKSPACE_NAME })
      .returning();
  }
  const workspaceId = ws!.id;

  let [user] = await db.select().from(t.users).where(eq(t.users.email, SYSTEM_USER_EMAIL));
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: SYSTEM_USER_EMAIL, name: 'You' })
      .returning();
  }
  const userId = user!.id;

  await db
    .insert(t.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner' })
    .onConflictDoNothing();

  // ---- default settings ----
  const defaultSettings: Record<string, unknown> = {
    polling_interval_min: 5,
    theme: 'dark',
    density: 'regular',
    sync_to_folder: true,
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoNothing();
  }

  // ---- demo repo (acme/payments-api) ----
  let [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'payments-api',
        fullName: 'acme/payments-api',
        defaultBranch: 'main',
        clonePath: null,
        createdBy: userId,
      })
      .returning();
  }
  const repoId = repo!.id;

  // ---- PR #482 (rate limiting) ----
  let [pr] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 482)));
  if (!pr) {
    [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 482,
        title: 'Add rate limiting to public API endpoints',
        author: 'marisa.koch',
        branch: 'feat/rate-limit-public',
        base: 'main',
        headSha: 'a1b2c3d4e5f6',
        additions: 247,
        deletions: 38,
        filesCount: 9,
        status: 'needs_review',
        body: 'Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.',
      })
      .returning();

    // pr_files (subset)
    await db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'src/middleware/ratelimit.ts', additions: 84, deletions: 0 },
      { prId: pr!.id, path: 'src/api/public/webhooks.ts', additions: 31, deletions: 6 },
      { prId: pr!.id, path: 'src/config.ts', additions: 4, deletions: 0 },
      { prId: pr!.id, path: 'src/api/users.ts', additions: 7, deletions: 2 },
    ]);

    // pr_commits
    await db.insert(t.prCommits).values({
      prId: pr!.id,
      sha: 'a1b2c3d4e5f6',
      message: 'Add token-bucket rate limiter',
      author: 'marisa.koch',
    });

    // a completed agent_run so the PR shows a finished review (with token usage)
    // before the first live run — this is what the cost badge prices on read.
    const [seedRun] = await db
      .insert(t.agentRuns)
      .values({
        workspaceId,
        agentId: null,
        prId: pr!.id,
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        status: 'done',
        durationMs: 8200,
        tokensIn: 9119,
        tokensOut: 1210,
        findingsCount: 3,
        grounding: '2/3 kept',
        score: 61,
        blockers: 1,
        source: 'local',
      })
      .returning();

    // a sample review + findings so the PR shows results before the first run
    const [review] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        runId: seedRun!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
        score: 61,
        model: DEFAULT_MODEL,
      })
      .returning();

    await db.insert(t.findings).values([
      {
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Hardcoded Stripe secret key in commit',
        rationale: 'Line 12 contains a literal `sk_live_` Stripe secret key.',
        suggestion: 'Move to env var and rotate the key immediately.',
        confidence: 0.98,
      },
      {
        reviewId: review!.id,
        file: 'src/api/users.ts',
        startLine: 45,
        endLine: 52,
        severity: 'WARNING',
        category: 'perf',
        title: 'N+1 query in user list endpoint',
        rationale: 'Loop issues one query per user → N+1.',
        suggestion: 'Use a single IN query and group in memory.',
        confidence: 0.86,
      },
      {
        reviewId: review!.id,
        file: 'src/middleware/ratelimit.ts',
        startLine: 28,
        endLine: 28,
        severity: 'SUGGESTION',
        category: 'style',
        title: 'Extract magic number 3600',
        rationale: 'The number 3600 appears twice without explanation; a reader has to infer it means seconds-in-an-hour.',
        suggestion: 'Hoist to a named constant `SECONDS_PER_HOUR`.',
        confidence: 0.62,
      },
    ]);
  }

  // ---- built-in agents (the three starter presets) ----
  // Prompt bodies live in ./seed-prompts.ts (mirrored in docs/agent-prompts/*.md).
  const seedAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'General Reviewer',
      description: 'Reviews a PR diff for bugs, correctness, and clarity.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: GENERAL_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Security Reviewer',
      description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: SECURITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Performance Reviewer',
      description: 'Catches N+1 queries, missing indexes, and hot-path allocations.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: PERFORMANCE_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  for (const a of seedAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (!existing) await db.insert(t.agents).values(a);
  }

  // ---- skills (manual source) ----
  const seedSkills: Array<{ slug: string; row: typeof t.skills.$inferInsert }> = [
    {
      slug: 'uncovered-branch-rubric',
      row: {
        workspaceId,
        name: 'uncovered-branch-rubric',
        description: 'Verifies every conditional branch has corresponding test coverage.',
        type: 'rubric',
        source: 'manual',
        body: UNCOVERED_BRANCH_RUBRIC,
      },
    },
    {
      slug: 'corner-case-checklist',
      row: {
        workspaceId,
        name: 'corner-case-checklist',
        description: 'Checklist of common missed corner cases: empty, null, boundary, concurrent.',
        type: 'convention',
        source: 'manual',
        body: CORNER_CASE_CHECKLIST,
      },
    },
    {
      slug: 'over-mocking-gate',
      row: {
        workspaceId,
        name: 'over-mocking-gate',
        description: 'Flags tests that mock too deeply and miss real integration failures.',
        type: 'rubric',
        source: 'manual',
        body: OVER_MOCKING_GATE,
      },
    },
    {
      slug: 'flaky-test-smells',
      row: {
        workspaceId,
        name: 'flaky-test-smells',
        description: 'Detects timing-dependent, random, or globally-stateful test patterns.',
        type: 'convention',
        source: 'manual',
        body: FLAKY_TEST_SMELLS,
      },
    },
    {
      slug: 'api-contract-breaking-change',
      row: {
        workspaceId,
        name: 'api-contract-breaking-change',
        description: 'Detects breaking changes to API contracts: removed fields, renamed routes, type changes.',
        type: 'security',
        source: 'manual',
        body: API_CONTRACT_BREAKING_CHANGE,
      },
    },
  ];

  const skillIdByName: Record<string, string> = {};
  for (const { row } of seedSkills) {
    const [existing] = await db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, row.name)));
    if (existing) {
      skillIdByName[row.name] = existing.id;
    } else {
      const [inserted] = await db.insert(t.skills).values(row).returning();
      skillIdByName[row.name] = inserted!.id;
    }
  }

  // ---- new reviewer agents: Test Quality + API Contract ----
  const newAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'Test Quality Reviewer',
      description: 'Catches uncovered branches, corner cases, over-mocking, and flaky test patterns.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: TEST_QUALITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'API Contract Reviewer',
      description: 'Flags breaking route-signature and DTO contract changes before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: API_CONTRACT_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];

  const agentIdByName: Record<string, string> = {};
  for (const a of newAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (existing) {
      agentIdByName[a.name] = existing.id;
    } else {
      const [inserted] = await db.insert(t.agents).values(a).returning();
      agentIdByName[a.name] = inserted!.id;
    }
  }

  // ---- agent_skills links ----
  // Test Quality Reviewer: 4 skills
  const testQualityAgentId = agentIdByName['Test Quality Reviewer']!;
  const testQualityLinks = [
    { skillName: 'uncovered-branch-rubric', order: 0 },
    { skillName: 'corner-case-checklist', order: 1 },
    { skillName: 'over-mocking-gate', order: 2 },
    { skillName: 'flaky-test-smells', order: 3 },
  ];
  for (const { skillName, order } of testQualityLinks) {
    await db
      .insert(t.agentSkills)
      .values({
        agentId: testQualityAgentId,
        skillId: skillIdByName[skillName]!,
        order,
        enabled: true,
      })
      .onConflictDoNothing();
  }

  // API Contract Reviewer: 1 skill
  const apiContractAgentId = agentIdByName['API Contract Reviewer']!;
  await db
    .insert(t.agentSkills)
    .values({
      agentId: apiContractAgentId,
      skillId: skillIdByName['api-contract-breaking-change']!,
      order: 0,
      enabled: true,
    })
    .onConflictDoNothing();

  // ---- control-experiment PRs ----

  // PR #701 — happy-path only tests
  let [pr701] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 701)));
  if (!pr701) {
    [pr701] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 701,
        title: 'feat: add payment retry logic',
        author: 'dev@acme.com',
        branch: 'feat/payment-retry',
        base: 'main',
        headSha: 'deadbeef701',
        additions: 62,
        deletions: 0,
        filesCount: 2,
        status: 'needs_review',
        body: 'Adds exponential backoff for failed payment attempts.',
      })
      .returning();

    await db.insert(t.prFiles).values([
      {
        prId: pr701!.id,
        path: 'src/retry.ts',
        additions: 40,
        deletions: 0,
        patch: `@@ -0,0 +1,40 @@
+export async function retryPayment(paymentId: string): Promise<boolean> {
+  const maxAttempts = 3;
+  let attempt = 0;
+  while (attempt < maxAttempts) {
+    try {
+      const result = await processPayment(paymentId);
+      if (result.success) {
+        return true;
+      } else {
+        attempt++;
+        await sleep(Math.pow(2, attempt) * 1000);
+      }
+    } catch (err) {
+      attempt++;
+      if (attempt >= maxAttempts) {
+        throw err;
+      }
+      await sleep(Math.pow(2, attempt) * 1000);
+    }
+  }
+  return false;
+}`,
      },
      {
        prId: pr701!.id,
        path: 'src/retry.test.ts',
        additions: 22,
        deletions: 0,
        patch: `@@ -0,0 +1,22 @@
+import { retryPayment } from './retry';
+import { processPayment } from './payment';
+
+jest.mock('./payment');
+
+describe('retryPayment', () => {
+  it('returns true when payment succeeds on first attempt', async () => {
+    (processPayment as jest.Mock).mockResolvedValue({ success: true });
+    const result = await retryPayment('pay_123');
+    expect(result).toBe(true);
+  });
+
+  // NOTE: no test for the failure path (success=false) or the thrown error path
+});`,
      },
    ]);
  }

  // PR #702 — breaking route signature change
  let [pr702] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 702)));
  if (!pr702) {
    [pr702] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 702,
        title: 'refactor: rename payment fields for consistency',
        author: 'dev@acme.com',
        branch: 'refactor/payment-fields',
        base: 'main',
        headSha: 'deadbeef702',
        additions: 3,
        deletions: 3,
        filesCount: 1,
        status: 'needs_review',
        body: 'Renames amount_cents to amount in the payment DTO for API consistency.',
      })
      .returning();

    await db.insert(t.prFiles).values([
      {
        prId: pr702!.id,
        path: 'src/dto/payment.ts',
        additions: 3,
        deletions: 3,
        patch: `@@ -1,10 +1,10 @@
 import { z } from 'zod';

 export const PaymentRequestSchema = z.object({
-  amount_cents: z.number().int().positive(),
+  amount: z.number().positive(),
   currency: z.string().length(3),
   recipient_id: z.string().uuid(),
 });

 export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;`,
      },
    ]);
  }

  return { workspaceId, userId };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  seed(handle.db)
    .then(async (r) => {
      console.log('✓ seeded', r);
      await handle.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ seed failed:', err);
      await handle.close();
      process.exit(1);
    });
}
