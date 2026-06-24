import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { buildSmartDiff } from './service.js';

/**
 * smart-diff module.
 *   GET /pulls/:id/smart-diff  → deterministic SmartDiff (no LLM, no cache)
 *
 * No rate-limit config: this endpoint is compute-only (classify + group DB
 * rows); no model call cost, so the global 120/min cap is sufficient.
 */
export default async function smartDiffRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/pulls/:id/smart-diff',
    { schema: { params: IdParams } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return buildSmartDiff(container, workspaceId, req.params.id);
    },
  );
}
