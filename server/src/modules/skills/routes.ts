import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType, SkillSource } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError, AppError } from '../../platform/errors.js';
import { SkillsService } from './service.js';

/** `/skills/:id/versions/:version` — id is a uuid, version a positive integer. */
const VersionParams = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

const CreateSkillBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: SkillType,
  source: SkillSource,
  body: z.string().min(1),
  enabled: z.boolean().optional(),
});

const UpdateSkillBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: SkillType.optional(),
  source: SkillSource.optional(),
  body: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

/**
 * A1 — skills module (owner A1).
 *   GET    /skills                         → list (workspace-scoped)
 *   GET    /skills/:id                     → one skill
 *   POST   /skills                         → create → 201
 *   PUT    /skills/:id                     → update / toggle enabled (versions body)
 *   DELETE /skills/:id                     → delete
 *   GET    /skills/:id/versions            → body history (newest first)
 *   GET    /skills/:id/versions/:version   → one body snapshot
 *   POST   /skills/:id/versions/:version/restore → restore old body as new version
 *   GET    /skills/:id/stats               → used-by count + agents list
 */

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const body = req.body;
    const skill = await service.create(workspaceId, {
      name: body.name,
      type: body.type,
      source: body.source,
      body: body.body,
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    });
    reply.status(201);
    return skill;
  });

  app.put(
    '/skills/:id',
    { schema: { params: IdParams, body: UpdateSkillBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.update(workspaceId, req.params.id, req.body);
      if (!skill) throw new NotFoundError('Skill not found');
      return skill;
    },
  );

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.get(
    '/skills/:id/versions/:version',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const version = await service.getVersion(workspaceId, req.params.id, req.params.version);
      if (!version) throw new NotFoundError('Skill version not found');
      return version;
    },
  );

  app.post(
    '/skills/:id/versions/:version/restore',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.restoreVersion(
        workspaceId,
        req.params.id,
        req.params.version,
      );
      if (!skill) throw new NotFoundError('Skill or version not found');
      return skill;
    },
  );

  app.get('/skills/:id/stats', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const stats = await service.stats(workspaceId, req.params.id);
    if (!stats) throw new NotFoundError('Skill not found');
    return stats;
  });

  /**
   * POST /skills/import/preview
   *
   * Accept a multipart file upload (.md or .zip) and return the parsed skill
   * preview — name, description, type, body, and ignored_files. Nothing is
   * written to the database; the client calls POST /skills to persist on confirm.
   */
  app.post('/skills/import/preview', async (req, reply) => {
    // @fastify/multipart attaches req.file() when registered.
    const uploadFn = (req as unknown as { file?: () => Promise<{
      filename: string;
      mimetype: string;
      toBuffer: () => Promise<Buffer>;
    } | null> }).file;

    if (typeof uploadFn !== 'function') {
      throw new AppError('multipart_not_supported', 'Multipart plugin is not registered', 500);
    }

    const upload = await uploadFn.call(req);
    if (!upload) {
      throw new AppError('no_file', 'No file was uploaded', 422);
    }

    const { filename, mimetype } = upload;
    const buffer = await upload.toBuffer();

    const preview = await service.previewImport({ buffer, mimetype, filename });
    reply.status(200);
    return preview;
  });
}
