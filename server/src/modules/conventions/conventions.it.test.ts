import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

d('conventions module (integration)', () => {
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

  const makeApp = () => buildApp({ config: config(), db: pg.handle.db, overrides: {} });

  it('returns an empty list when nothing is extracted yet', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/conventions' });
    await app.close();
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns conventions scoped by repoId, mapped to the DTO', async () => {
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'conv-repo', fullName: 'acme/conv-repo' })
      .returning();
    await pg.handle.db.insert(t.conventions).values({
      workspaceId,
      repoId: repo!.id,
      rule: 'Prefer named exports',
      evidencePath: 'src/index.ts',
      evidenceSnippet: 'export const x',
      confidence: 0.9,
      accepted: true,
    });

    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: `/conventions?repoId=${repo!.id}` });
    await app.close();

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json<Array<Record<string, unknown>>>();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      rule: 'Prefer named exports',
      repo_id: repo!.id,
      evidence_path: 'src/index.ts',
      accepted: true,
    });
  });

  it('rejects a non-uuid repoId with 422', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/conventions?repoId=not-a-uuid' });
    await app.close();
    expect(res.statusCode).toBe(422);
  });
});
