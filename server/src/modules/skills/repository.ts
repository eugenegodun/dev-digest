import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillType, SkillSource } from '@devdigest/shared';
import { INITIAL_SKILL_VERSION } from './constants.js';

/**
 * A1 — skills data-access. Owns `skills` and `skill_versions`.
 * The `agent_skills` link table is owned by the agents repository (A2) on the
 * agent side; this repository provides read access to it via `usedByAgents`.
 * Workspace-scoped throughout.
 */

import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
export type { SkillRow, SkillVersionRow };

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description?: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled?: boolean;
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  source?: SkillSource;
  body?: string;
  enabled?: boolean;
}

export class SkillsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<SkillRow[]> {
    return this.db.select().from(t.skills).where(eq(t.skills.workspaceId, workspaceId));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** Delete a skill (scoped to workspace). skill_versions and agent_skills cascade.
   *  Returns false if no such skill existed in the workspace. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  /** Insert a skill AND record version 1 in skill_versions (immutable body snapshot). */
  async insert(values: InsertSkill): Promise<SkillRow> {
    const [row] = await this.db
      .insert(t.skills)
      .values({
        workspaceId: values.workspaceId,
        name: values.name,
        description: values.description ?? '',
        type: values.type,
        source: values.source,
        body: values.body,
        enabled: values.enabled ?? true,
        version: INITIAL_SKILL_VERSION,
      })
      .returning();
    await this.snapshotVersion(row!.id, INITIAL_SKILL_VERSION, row!.body);
    return row!;
  }

  /**
   * Update a skill. Any config change bumps the version and snapshots the new
   * body into skill_versions. Toggling `enabled` alone does NOT bump the version.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkill,
  ): Promise<SkillRow | undefined> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;

    // body/type/description changes bump version; enabled-only toggle does not.
    const configChanged =
      (patch.body !== undefined && patch.body !== existing.body) ||
      (patch.name !== undefined && patch.name !== existing.name) ||
      (patch.description !== undefined && patch.description !== existing.description) ||
      (patch.type !== undefined && patch.type !== existing.type);

    const nextVersion = configChanged ? existing.version + 1 : existing.version;

    const [row] = await this.db
      .update(t.skills)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.source !== undefined ? { source: patch.source } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(configChanged ? { version: nextVersion } : {}),
      })
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning();

    if (configChanged && row) {
      await this.snapshotVersion(row.id, nextVersion, row.body);
    }
    return row;
  }

  private async snapshotVersion(skillId: string, version: number, body: string): Promise<void> {
    await this.db
      .insert(t.skillVersions)
      .values({ skillId, version, body })
      .onConflictDoNothing();
  }

  // ---- skill_versions (immutable body snapshots) --------------------------

  /** All body snapshots for a skill, newest version first. */
  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  /** A single body snapshot, or undefined if that version was never recorded. */
  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }

  /**
   * Restore an old version's body as a NEW version on the skill.
   * Bumps skill.version, inserts a new skill_versions row with the old body.
   * Does NOT reuse the old version number — history is always immutable.
   * Returns the updated skill row, or undefined if skill not in workspace.
   */
  async restoreVersion(
    workspaceId: string,
    skillId: string,
    version: number,
  ): Promise<SkillRow | undefined> {
    const existing = await this.getById(workspaceId, skillId);
    if (!existing) return undefined;

    const old = await this.getVersion(skillId, version);
    if (!old) return undefined;

    const nextVersion = existing.version + 1;

    const [row] = await this.db
      .update(t.skills)
      .set({ body: old.body, version: nextVersion })
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, skillId)))
      .returning();

    if (row) {
      await this.snapshotVersion(skillId, nextVersion, old.body);
    }
    return row;
  }

  // ---- agent_skills read (A1 read side — A2 owns writes) ------------------

  /**
   * Agents that have this skill linked, along with whether the link is enabled.
   * Used by the stats endpoint.
   */
  async usedByAgents(
    skillId: string,
  ): Promise<{ id: string; name: string; enabled: boolean }[]> {
    const rows = await this.db
      .select({
        id: t.agents.id,
        name: t.agents.name,
        enabled: t.agentSkills.enabled,
      })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(eq(t.agentSkills.skillId, skillId));
    return rows;
  }
}
