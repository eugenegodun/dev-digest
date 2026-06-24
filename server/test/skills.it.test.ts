import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';
import { AgentsRepository } from '../src/modules/agents/repository.js';
import type { Container } from '../src/platform/container.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * Skills module integration tests — versions/restore/stats/body_tokens.
 * Mirrors agents-versions.it.test.ts in structure.
 */
d('Skills module', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  const createBody = {
    name: 'Test Skill',
    type: 'rubric' as const,
    source: 'manual' as const,
    body: 'Review for correctness.',
  };

  it('a new skill has exactly one version (v1) captured', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    expect(created.statusCode).toBe(201);
    const skillId = created.json().id as string;

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` });
    expect(res.statusCode).toBe(200);
    const versions = res.json();
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);
    expect(versions[0].body).toBe(createBody.body);
    await app.close();
  });

  it('listVersions returns newest first', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    // Update body → bumps version to 2
    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { body: 'Review for style and correctness.' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().version).toBe(2);

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` })
    ).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0].body).toBe('Review for style and correctness.');
    expect(versions[1].body).toBe(createBody.body);
    await app.close();
  });

  it('restoreVersion writes old body as a NEW version number (history intact)', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    // Bump to v2
    await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { body: 'Second body.' },
    });

    // Restore v1 → should produce v3 (not reuse v1)
    const restored = await app.inject({
      method: 'POST',
      url: `/skills/${skillId}/versions/1/restore`,
    });
    expect(restored.statusCode).toBe(200);
    const skill = restored.json();
    expect(skill.version).toBe(3);
    expect(skill.body).toBe(createBody.body);

    // Verify history: v3, v2, v1 all present
    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` })
    ).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
    await app.close();
  });

  it('stats returns used_by_count=0 for unlinked skill', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/stats` });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.used_by_count).toBe(0);
    expect(stats.agents).toEqual([]);
    await app.close();
  });

  it('stats returns used_by_count=1 after linking to an agent', async () => {
    const app = await makeApp();
    const { db } = pg.handle;

    // Get default workspace id
    const [{ workspaceId }] = await db
      .select({ workspaceId: t.workspaces.id })
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));

    // Create a skill
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    // Create an agent
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: {
          name: 'Stats Test Agent',
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          system_prompt: 'Review.',
        },
      })
    ).json().id as string;

    // Link the skill to the agent via agent_skills
    const agentsRepo = new AgentsRepository(db);
    await agentsRepo.linkSkill(agentId, skillId, 0);

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/stats` });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.used_by_count).toBe(1);
    expect(stats.agents).toHaveLength(1);
    expect(stats.agents[0].id).toBe(agentId);
    await app.close();
  });

  it('body_tokens is a positive integer in the skill DTO', async () => {
    const app = await makeApp();
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { ...createBody, body: 'This is a non-trivial body with some tokens.' },
    });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(typeof skill.body_tokens).toBe('number');
    expect(Number.isInteger(skill.body_tokens)).toBe(true);
    expect(skill.body_tokens).toBeGreaterThan(0);
    await app.close();
  });

  it('404s for unknown skill in versions, restore, stats', async () => {
    const app = await makeApp();
    const ghost = '00000000-0000-0000-0000-000000000000';

    expect(
      (await app.inject({ method: 'GET', url: `/skills/${ghost}/versions` })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: `/skills/${ghost}/versions/1` })).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({ method: 'POST', url: `/skills/${ghost}/versions/1/restore` })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: `/skills/${ghost}/stats` })).statusCode,
    ).toBe(404);
    await app.close();
  });

  it('a non-numeric :version is rejected at the edge (422, not 404)', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;
    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/versions/abc` });
    expect(res.statusCode).toBe(422);
    await app.close();
  });
});
