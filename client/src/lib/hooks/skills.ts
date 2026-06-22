/* hooks/skills.ts — React Query hooks for the Skills feature.
   Covers workspace skill CRUD + per-agent skill link management. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Skill, AgentSkillLink } from "@devdigest/shared";

// ---- Workspace skills ----

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
