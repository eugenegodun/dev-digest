/* hooks/brief.ts — React Query hook for the PR Brief endpoint.
   GET /pulls/:id/brief → PrBrief { intent, blast, risks, history }
   Phase 1 populates intent; blast/risks/history are empty-but-valid. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { PrBrief } from "@devdigest/shared";

export function usePrBrief(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["brief", prId],
    queryFn: () => api.get<PrBrief>(`/pulls/${prId}/brief`),
    enabled: !!prId,
  });
}
