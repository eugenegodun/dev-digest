import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { getOrBuildBrief } from './service.js';

/**
 * brief module.
 *   GET /pulls/:id/brief  → build or return cached PrBrief (intent + empty sections)
 *
 * The build path invokes the LLM (cheap model via review_intent feature model),
 * so a tighter per-route rate limit mirrors the reviews module (max 10 / 1 min).
 */
export default async function briefRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/pulls/:id/brief',
    {
      schema: { params: IdParams },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return getOrBuildBrief(container, workspaceId, req.params.id);
    },
  );
}
