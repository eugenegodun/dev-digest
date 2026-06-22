/* hooks/skills.ts — React Query hooks for the Skills Lab feature (Phase 5+).
   Covers workspace skill CRUD, versions, stats, and per-agent skill link management. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Skill, SkillStats, SkillType, SkillSource, AgentSkillLink } from "@devdigest/shared";

// ---- Skill CRUD ----

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  type?: SkillType;
  source?: SkillSource;
  body?: string;
  enabled?: boolean;
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: Partial<Pick<Skill, "name" | "description" | "type" | "enabled" | "body">>;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
    },
  });
}

// ---- Skill versions ----

export interface SkillVersionRow {
  skill_id: string;
  version: number;
  body: string;
  note: string | null;
  created_at: string;
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id, "versions"],
    queryFn: () => api.get<SkillVersionRow[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export interface RestoreSkillVersionInput {
  id: string;
  version: number;
}

export function useRestoreSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: RestoreSkillVersionInput) =>
      api.post<Skill>(`/skills/${id}/versions/${version}/restore`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
      qc.invalidateQueries({ queryKey: ["skill", data.id, "versions"] });
    },
  });
}

// ---- Skill stats ----

export function useSkillStats(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id, "stats"],
    queryFn: () => api.get<SkillStats>(`/skills/${id}/stats`),
    enabled: !!id,
  });
}

// ---- Agent ↔ skill links ----

export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent", agentId, "skills"],
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

/**
 * Set the full ordered list of skill IDs for an agent.
 * POST /agents/:id/skills { skill_ids: string[] }
 *
 * Note: the current endpoint only accepts an ordered array of IDs.
 * Per-link `enabled` toggling requires the `agent_skills.enabled` column to be
 * added (spec §4) and the SetSkillsBody schema to be extended — tracked as a
 * follow-up (TODO: wire enabled per-link once the schema migration lands).
 */
export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillIds }: { agentId: string; skillIds: string[] }) =>
      api.post<AgentSkillLink[]>(`/agents/${agentId}/skills`, { skill_ids: skillIds }),
    onSuccess: (_data, { agentId }) => {
      qc.invalidateQueries({ queryKey: ["agent", agentId, "skills"] });
    },
  });
}
