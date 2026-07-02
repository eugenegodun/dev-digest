import { z } from "zod";

import type { Config } from "../config.js";
import { ApiError } from "../errors.js";
import {
  AgentRow,
  ConventionDto,
  PrMeta,
  RepoRow,
  ReviewDto,
  type RunStarted,
  RunSummary,
  StartReviewResponse,
} from "./types.js";

/**
 * Thin typed HTTP client over @devdigest/api (:3001). One method per endpoint
 * the MCP tools consume. No auth (the local API resolves the workspace
 * server-side). Network failures and error envelopes become ApiError.
 */
export interface ApiClient {
  listAgents(): Promise<AgentRow[]>;
  listRepos(): Promise<RepoRow[]>;
  listPullsForRepo(repoId: string): Promise<PrMeta[]>;
  listRuns(prId: string): Promise<RunSummary[]>;
  reviewsForPull(prId: string): Promise<ReviewDto[]>;
  /** Start ONE agent's review on a PR; resolves with the created run. */
  startReview(prId: string, agentId: string): Promise<RunStarted>;
  getConventions(repoId?: string): Promise<ConventionDto[]>;
}

export function createApiClient(config: Config): ApiClient {
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${config.apiBaseUrl}${path}`, {
        ...init,
        headers: {
          ...(init?.body != null ? { "content-type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch (e) {
      throw new ApiError(
        `Cannot reach the DevDigest engine at ${config.apiBaseUrl}. Is the API running?`,
        0,
        "network_error",
        e,
      );
    }

    if (!res.ok) {
      let code: string | undefined;
      let message = `${res.status} ${res.statusText}`;
      let details: unknown;
      try {
        const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
        if (body?.error) {
          code = body.error.code;
          message = body.error.message ?? message;
          details = body.error.details;
        }
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(message, res.status, code, details);
    }

    const json: unknown = await res.json();
    return schema.parse(json);
  }

  return {
    listAgents: () => request("/agents", z.array(AgentRow)),
    listRepos: () => request("/repos", z.array(RepoRow)),
    listPullsForRepo: (repoId) =>
      request(`/repos/${repoId}/pulls`, z.array(PrMeta)),
    listRuns: (prId) => request(`/pulls/${prId}/runs`, z.array(RunSummary)),
    reviewsForPull: (prId) =>
      request(`/pulls/${prId}/reviews`, z.array(ReviewDto)),
    startReview: async (prId, agentId) => {
      const res = await request(
        `/pulls/${prId}/review`,
        StartReviewResponse,
        { method: "POST", body: JSON.stringify({ agentId }) },
      );
      const run = res.runs[0];
      if (!run) {
        throw new ApiError(
          "The review was accepted but no run was created (the agent may be disabled).",
          409,
          "no_run_created",
        );
      }
      return run;
    },
    getConventions: (repoId) =>
      request(
        repoId
          ? `/conventions?repoId=${encodeURIComponent(repoId)}`
          : "/conventions",
        z.array(ConventionDto),
      ),
  };
}
