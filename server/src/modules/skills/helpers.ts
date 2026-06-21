import type { Skill, SkillType, SkillSource } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import type { SkillRow } from '../../db/rows.js';
import type { UpdateSkill } from './repository.js';

/**
 * Pure helpers for the skills module — DB row ⇄ DTO mapping and the
 * config-version-bump rule. No I/O.
 */

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow, container: Container): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: (row.evidenceFiles ?? null) as string[] | null,
    body_tokens: container.tokenizer.count(row.body),
  };
}

/**
 * True when a patch changes config (body/type/description) relative to the
 * existing row — a config change bumps the version and snapshots skill_versions.
 * enabled-only changes do NOT bump.
 */
export function isConfigChange(existing: SkillRow, patch: UpdateSkill): boolean {
  return (
    (patch.body !== undefined && patch.body !== existing.body) ||
    (patch.type !== undefined && patch.type !== existing.type) ||
    (patch.description !== undefined && patch.description !== existing.description)
  );
}
