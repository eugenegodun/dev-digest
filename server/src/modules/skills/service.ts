import type { Skill, SkillStats, SkillType, SkillSource } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { SkillsRepository } from './repository.js';
import type { SkillVersionRow } from '../../db/rows.js';
import { toSkillDto } from './helpers.js';

/**
 * A1 — skills service. Business logic for the Skills tab + Skill Editor.
 * All methods are workspace-scoped; undefined return = 404 at the route layer.
 *
 * A Skill = type + source + markdown body + enabled. Config changes are versioned
 * via `skill_versions` (repository).
 */

export interface CreateSkillInput {
  name: string;
  description?: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  source?: SkillSource;
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
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? toSkillDto(row, this.container) : undefined;
  }

  /** Delete a skill (and its versions/agent-links, via cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /**
   * Body snapshots for a skill, newest version first. Returns undefined when
   * the skill isn't in this workspace (route maps that to 404).
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
   * A single body snapshot. Returns undefined when skill isn't in this workspace
   * OR that version was never recorded (route → 404).
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
   * Restore an old version's body as a new (bumped) version.
   * History is immutable — the old version number is not reused.
   */
  async restoreVersion(
    workspaceId: string,
    skillId: string,
    version: number,
  ): Promise<Skill | undefined> {
    const row = await this.repo.restoreVersion(workspaceId, skillId, version);
    return row ? toSkillDto(row, this.container) : undefined;
  }

  /**
   * Real-data stats: which agents have this skill linked, and is each link enabled.
   * Returns undefined when the skill isn't in this workspace (route → 404).
   */
  async stats(workspaceId: string, skillId: string): Promise<SkillStats | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const agents = await this.repo.usedByAgents(skillId);
    return {
      used_by_count: agents.length,
      agents,
    };
  }
}
