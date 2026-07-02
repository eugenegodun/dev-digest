import { and, eq } from 'drizzle-orm';
import type { Container } from '../../platform/container.js';
import * as t from '../../db/schema.js';

/**
 * conventions data + service. Reads the `conventions` table
 * (db/schema/knowledge.ts), workspace-scoped, optionally filtered by repo.
 *
 * The table is populated by a later lesson's extractor; until then `list`
 * returns an empty array. Read-only — no writes here.
 */
export interface ConventionDto {
  id: string;
  repo_id: string | null;
  rule: string;
  evidence_path: string | null;
  evidence_snippet: string | null;
  confidence: number | null;
  accepted: boolean;
}

export class ConventionsService {
  constructor(private container: Container) {}

  async list(workspaceId: string, repoId?: string): Promise<ConventionDto[]> {
    const rows = await this.container.db
      .select()
      .from(t.conventions)
      .where(
        repoId
          ? and(
              eq(t.conventions.workspaceId, workspaceId),
              eq(t.conventions.repoId, repoId),
            )
          : eq(t.conventions.workspaceId, workspaceId),
      );

    return rows.map((r) => ({
      id: r.id,
      repo_id: r.repoId,
      rule: r.rule,
      evidence_path: r.evidencePath,
      evidence_snippet: r.evidenceSnippet,
      confidence: r.confidence,
      accepted: r.accepted,
    }));
  }
}
