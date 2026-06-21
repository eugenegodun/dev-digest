import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { MockGitClient, MockGitHubClient } from '../../adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * Skills module integration tests — CRUD round-trip, version bumps, stats,
 * cascade deletes, and agent_skills.enabled propagation.
 */
d('Skills CRUD + versioning + stats', () => {
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
    name: 'No TODO comments',
    description: 'Reject any line that introduces a TODO comment.',
    type: 'convention' as const,
    source: 'manual' as const,
    body: '## No TODO comments\n\nDo not approve PRs that introduce TODO comments.',
  };

  // ---- CRUD round-trip ------------------------------------------------

  it('POST /skills creates a skill and returns 201 with all fields', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      name: createBody.name,
      description: createBody.description,
      type: createBody.type,
      source: createBody.source,
      body: createBody.body,
      enabled: true,
      version: 1,
    });
    expect(typeof body.id).toBe('string');
    expect(typeof body.body_tokens).toBe('number');
    expect(body.body_tokens).toBeGreaterThan(0);
    await app.close();
  });

  it('GET /skills lists all skills in the workspace', async () => {
    const app = await makeApp();
    await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    const res = await app.inject({ method: 'GET', url: '/skills' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
    await app.close();
  });

  it('GET /skills/:id returns the skill by id', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    const skillId = created.json().id as string;

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: skillId, name: createBody.name });
    await app.close();
  });

  it('GET /skills/:id returns 404 for an unknown id', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/skills/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('PUT /skills/:id updates the skill', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const res = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { name: 'Updated name' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Updated name');
    await app.close();
  });

  it('PUT /skills/:id returns 404 for an unknown id', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/skills/00000000-0000-0000-0000-000000000000',
      payload: { name: 'x' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('DELETE /skills/:id removes the skill and returns ok', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });
    expect(del.statusCode).toBe(200);
    expect(del.json().ok).toBe(true);

    const get = await app.inject({ method: 'GET', url: `/skills/${skillId}` });
    expect(get.statusCode).toBe(404);
    await app.close();
  });

  it('DELETE /skills/:id returns 404 for an unknown id', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/skills/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  // ---- Version bumping ------------------------------------------------

  it('a new skill has exactly one version (v1) in skill_versions', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` });
    expect(res.statusCode).toBe(200);
    const versions = res.json();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ skillId, version: 1 });
    await app.close();
  });

  it('changing the body bumps the version and snapshots skill_versions', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { body: '## Updated body\n\nNew instructions here.' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().version).toBe(2);

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` })
    ).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0].body).toBe('## Updated body\n\nNew instructions here.');
    expect(versions[1].body).toBe(createBody.body);
    await app.close();
  });

  it('changing the type bumps the version', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { type: 'rubric' },
    });
    expect(updated.json().version).toBe(2);
    await app.close();
  });

  it('changing the description bumps the version', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { description: 'New description.' },
    });
    expect(updated.json().version).toBe(2);
    await app.close();
  });

  it('toggling enabled does NOT bump the version', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { enabled: false },
    });
    expect(updated.json().version).toBe(1);

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` })
    ).json();
    expect(versions).toHaveLength(1);
    await app.close();
  });

  it('changing name does NOT bump the version (name is not a config field)', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { name: 'Renamed skill' },
    });
    expect(updated.json().version).toBe(1);
    await app.close();
  });

  it('GET /skills/:id/versions/:version returns one snapshot', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;
    await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { body: 'Changed body.' },
    });

    const v1 = await app.inject({ method: 'GET', url: `/skills/${skillId}/versions/1` });
    expect(v1.statusCode).toBe(200);
    expect(v1.json()).toMatchObject({ version: 1, body: createBody.body });
    await app.close();
  });

  it('GET /skills/:id/versions returns 404 for an unknown skill', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/skills/00000000-0000-0000-0000-000000000000/versions',
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('a non-numeric :version is rejected at the edge (422)', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/versions/abc` });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  // ---- Stats ----------------------------------------------------------

  it('GET /skills/:id/stats returns used_by_count=0 when no agents link the skill', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/stats` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ used_by_count: 0, agents: [] });
    await app.close();
  });

  it('GET /skills/:id/stats reflects linked agents and their used_by_count', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    // Create an agent and link the skill to it.
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: {
          name: 'Test Agent',
          provider: 'openai',
          model: 'gpt-4o-mini',
          system_prompt: 'Review the diff.',
        },
      })
    ).json().id as string;

    await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: skillId },
    });

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/stats` });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.used_by_count).toBe(1);
    expect(stats.agents).toHaveLength(1);
    expect(stats.agents[0]).toMatchObject({ id: agentId, name: 'Test Agent' });
    await app.close();
  });

  it('GET /skills/:id/stats returns 404 for an unknown skill', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/skills/00000000-0000-0000-0000-000000000000/stats',
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  // ---- Cascade delete -------------------------------------------------

  it('deleting a skill cascades to agent_skills (unlinks from agents)', async () => {
    const { db } = pg.handle;
    const app = await makeApp();

    // Create skill + agent and link them.
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: {
          name: 'Cascade Agent',
          provider: 'openai',
          model: 'gpt-4o-mini',
          system_prompt: 'x',
        },
      })
    ).json().id as string;
    await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: skillId },
    });

    // Confirm the link exists.
    const linksBefore = await db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.skillId, skillId));
    expect(linksBefore).toHaveLength(1);

    // Delete the skill.
    await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });

    // Link should be cascade-deleted.
    const linksAfter = await db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.skillId, skillId));
    expect(linksAfter).toHaveLength(0);

    // Agent itself must still exist.
    const agentRes = await app.inject({ method: 'GET', url: `/agents/${agentId}` });
    expect(agentRes.statusCode).toBe(200);

    await app.close();
  });

  // ---- agent_skills.enabled propagation -------------------------------

  it('GET /agents/:id/skills includes enabled flag from agent_skills', async () => {
    const app = await makeApp();

    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: {
          name: 'Enabled Flag Agent',
          provider: 'openai',
          model: 'gpt-4o-mini',
          system_prompt: 'x',
        },
      })
    ).json().id as string;

    // Link the skill (defaults to enabled=true).
    await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: skillId },
    });

    const res = await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` });
    expect(res.statusCode).toBe(200);
    const links = res.json();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      agent_id: agentId,
      skill_id: skillId,
      order: 0,
      enabled: true,
    });
    await app.close();
  });
});
