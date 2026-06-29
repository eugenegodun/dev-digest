import { z } from "zod";

/**
 * Minimal local schemas for the @devdigest/api responses we consume. We
 * deliberately do NOT vendor the full @devdigest/shared contracts (no sync
 * script exists) — these validate only the fields the MCP tools read, and Zod
 * strips unknown keys, so extra server fields are ignored harmlessly.
 *
 * Note: GET /agents and GET /repos return Drizzle rows (camelCase keys); the
 * review/run/PR DTOs are snake_case. Field names below mirror the source.
 */

/** GET /agents → AgentRow[] (camelCase). */
export const AgentRow = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  provider: z.string(),
  model: z.string(),
  enabled: z.boolean(),
});
export type AgentRow = z.infer<typeof AgentRow>;

/** GET /repos → repo rows (camelCase). */
export const RepoRow = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string().nullish(),
});
export type RepoRow = z.infer<typeof RepoRow>;

/** GET /repos/:id/pulls → PrMeta[] (snake_case; `id` is nullish for unsynced). */
export const PrMeta = z.object({
  id: z.string().nullish(),
  number: z.number().int(),
  title: z.string(),
  author: z.string(),
  status: z.string(),
});
export type PrMeta = z.infer<typeof PrMeta>;

/** One run created by POST /pulls/:id/review. */
export const RunStarted = z.object({
  run_id: z.string(),
  agent_id: z.string().nullish(),
  agent_name: z.string().nullish(),
});
export type RunStarted = z.infer<typeof RunStarted>;

/** POST /pulls/:id/review → { pr_id, runs, reviews } (reviews always empty here). */
export const StartReviewResponse = z.object({
  pr_id: z.string(),
  runs: z.array(RunStarted),
  reviews: z.array(z.unknown()),
});
export type StartReviewResponse = z.infer<typeof StartReviewResponse>;

/** GET /pulls/:id/runs → RunSummary[] (subset). */
export const RunSummary = z.object({
  run_id: z.string(),
  status: z.string().nullable(),
  error: z.string().nullable(),
  findings_count: z.number().int().nullable(),
  score: z.number().int().nullable(),
  blockers: z.number().int().nullable(),
});
export type RunSummary = z.infer<typeof RunSummary>;

/** A finding as returned inside a ReviewDto (subset of the verbose shape). */
export const ReviewFinding = z.object({
  severity: z.string(),
  category: z.string(),
  title: z.string(),
  file: z.string(),
  start_line: z.number().int(),
  end_line: z.number().int(),
  rationale: z.string(),
  suggestion: z.string().nullish(),
});
export type ReviewFinding = z.infer<typeof ReviewFinding>;

/** GET /conventions[?repoId=] → ConventionDto[]. */
export const ConventionDto = z.object({
  id: z.string(),
  repo_id: z.string().nullable(),
  rule: z.string(),
  evidence_path: z.string().nullable(),
  evidence_snippet: z.string().nullable(),
  confidence: z.number().nullable(),
  accepted: z.boolean(),
});
export type ConventionDto = z.infer<typeof ConventionDto>;

/** GET /pulls/:id/reviews → ReviewDto[] (subset). */
export const ReviewDto = z.object({
  id: z.string(),
  pr_id: z.string(),
  run_id: z.string().nullable(),
  agent_name: z.string().nullish(),
  kind: z.string(),
  verdict: z.string().nullable(),
  summary: z.string().nullable(),
  score: z.number().nullable(),
  created_at: z.string(),
  findings: z.array(ReviewFinding),
});
export type ReviewDto = z.infer<typeof ReviewDto>;
