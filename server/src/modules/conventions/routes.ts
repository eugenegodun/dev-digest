import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { ConventionsService } from './service.js';

/**
 * conventions module.
 *   GET /conventions[?repoId=]  → repository coding conventions (workspace-scoped)
 *
 * Read-only. The conventions table is filled by a later lesson's extractor;
 * until then this returns an empty list (never an error).
 */
const ConventionsQuery = z.object({ repoId: z.string().uuid().optional() });

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get(
    '/conventions',
    { schema: { querystring: ConventionsQuery } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.list(workspaceId, req.query.repoId);
    },
  );
}
