/* hooks/brief.ts — React Query hooks for the PR Brief + Smart Diff endpoints.
   GET /pulls/:id/brief → PrBrief { intent, blast, risks, history }
   GET /pulls/:id/smart-diff → SmartDiff { groups, split_suggestion }
   Phase 1 populates intent; blast/risks/history are empty-but-valid. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { PrBrief, SmartDiff } from "@devdigest/shared";

export function usePrBrief(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["brief", prId],
    queryFn: () => api.get<PrBrief>(`/pulls/${prId}/brief`),
    enabled: !!prId,
  });
}

/** Smart Diff — deterministic file grouping (core/wiring/boilerplate) derived
 *  from PR files + latest review findings. No LLM call; cheap to refetch. */
export function usePrSmartDiff(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["smart-diff", prId],
    queryFn: () => api.get<SmartDiff>(`/pulls/${prId}/smart-diff`),
    enabled: !!prId,
  });
}
