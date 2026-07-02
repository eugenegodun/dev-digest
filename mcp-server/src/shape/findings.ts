import type { ReviewDto } from "../api/types.js";

/**
 * Concise structured response (design principle 3).
 *
 * A raw ReviewDto can be tens of thousands of tokens. We map it down to only
 * the fields the model needs, sort by severity (so truncation drops the least
 * important findings first), cap the count, and truncate long prose.
 */

export interface ConciseFinding {
  severity: string;
  category: string;
  file: string;
  start_line: number;
  end_line: number;
  title: string;
  suggestion: string | null;
  rationale: string;
}

export interface ConciseReview {
  run_id: string | null;
  verdict: string | null;
  score: number | null;
  summary: string | null;
  findings: ConciseFinding[];
  findings_truncated: boolean;
  total_findings: number;
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WARNING: 1,
  SUGGESTION: 2,
};

const RATIONALE_MAX = 240;
const SUMMARY_MAX = 500;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

export function mapReviewToConcise(
  review: ReviewDto,
  opts: { maxFindings?: number } = {},
): ConciseReview {
  const maxFindings = opts.maxFindings ?? 25;

  const sorted = [...review.findings].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
  );

  const findings: ConciseFinding[] = sorted.slice(0, maxFindings).map((f) => ({
    severity: f.severity,
    category: f.category,
    file: f.file,
    start_line: f.start_line,
    end_line: f.end_line,
    title: f.title,
    suggestion: f.suggestion ?? null,
    rationale: truncate(f.rationale, RATIONALE_MAX),
  }));

  return {
    run_id: review.run_id,
    verdict: review.verdict,
    score: review.score,
    summary: review.summary === null ? null : truncate(review.summary, SUMMARY_MAX),
    findings,
    findings_truncated: review.findings.length > maxFindings,
    total_findings: review.findings.length,
  };
}
