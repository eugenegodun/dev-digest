import type { Skill } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import type { SkillRow } from './repository.js';

/**
 * Pure helpers for the skills module — DB row ⇄ DTO mapping.
 * No I/O; body_tokens is computed via the injected tokenizer.
 */

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow, container: Container): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: (row.evidenceFiles as string[] | null | undefined) ?? null,
    body_tokens: container.tokenizer.count(row.body),
  };
}
