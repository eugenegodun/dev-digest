/* RunCostBadge — shows a run's cost (and optionally token usage) in two views.
   - "compact"  → just the cost, e.g. "$0.014" (PR-list column, review-run header)
   - "detailed" → cost · tokens, e.g. "$0.014 · 8k→1.3k" (verdict plate, timeline)
   Cost is computed server-side on read; a run with no usable data renders "—". */
"use client";

import React from "react";
import { formatCost, formatTokens } from "@/lib/format-cost";

export function RunCostBadge({
  costUsd,
  tokensIn,
  tokensOut,
  variant = "compact",
  style,
}: {
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  variant?: "compact" | "detailed";
  style?: React.CSSProperties;
}) {
  const cost = formatCost(costUsd);
  const showTokens =
    variant === "detailed" && tokensIn != null && tokensOut != null && (tokensIn > 0 || tokensOut > 0);
  return (
    <span
      className="mono"
      style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", ...style }}
    >
      {cost}
      {showTokens ? ` · ${formatTokens(tokensIn!, tokensOut!)}` : ""}
    </span>
  );
}

export default RunCostBadge;
