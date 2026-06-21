import type { Container } from '../../platform/container.js';
import type { Skill } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import type { InsertSkill, UpdateSkill } from './repository.js';
import { toSkillDto } from './helpers.js';
import type { SkillVersionRow } from '../../db/rows.js';

/**
 * A1 — skills service. Business logic for the Skills tab + Skill Editor.
 *
 * A Skill = type + source + markdown body + enabled. Config changes are versioned
 * via `skill_versions` (repository).
 */

export interface CreateSkillInput {
  name: string;
  description?: string;
  type: InsertSkill['type'];
  source: InsertSkill['source'];
  body: string;
  enabled?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: UpdateSkill['type'];
  source?: UpdateSkill['source'];
  body?: string;
  enabled?: boolean;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map((r) => toSkillDto(r, this.container));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row, this.container) : undefined;
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source: input.source,
      body: input.body,
      enabled: input.enabled,
    });
    return toSkillDto(row, this.container);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    return row ? toSkillDto(row, this.container) : undefined;
  }

  /** Delete a skill (and its versions/agent-links, via cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /**
   * Config history for a skill, newest version first. Workspace-scoped: returns
   * undefined when the skill isn't in this workspace (the route maps that to 404)
   * so version snapshots can't be read across tenants.
   */
  async listVersions(
    workspaceId: string,
    skillId: string,
  ): Promise<SkillVersionRow[] | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    return this.repo.listVersions(skillId);
  }

  /**
   * A single body snapshot for a skill. Returns undefined when the skill isn't
   * in this workspace OR that version was never recorded (route → 404).
   */
  async getVersion(
    workspaceId: string,
    skillId: string,
    version: number,
  ): Promise<SkillVersionRow | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    return this.repo.getVersion(skillId, version);
  }

  /**
   * Stats for a skill: how many agents use it and which ones.
   * Returns undefined when the skill isn't in this workspace (route → 404).
   */
  async stats(
    workspaceId: string,
    skillId: string,
  ): Promise<
    | { used_by_count: number; agents: { id: string; name: string; enabled: boolean }[] }
    | undefined
  > {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const agents = await this.repo.usedByAgents(skillId);
    return { used_by_count: agents.length, agents };
  }
}
