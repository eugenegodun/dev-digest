/**
 * Formatting for the Run Cost Badge. Cost is computed server-side on read
 * (tokens × model price); the client only formats it.
 */

/**
 * Money for a single run / cumulative PR cost. `null`/`undefined` (no usable
 * data — unpriced model or no token usage) renders the em dash "—", never
 * "$0.00", so a missing cost is never mistaken for a free run. Small costs keep
 * extra precision so they don't collapse to "$0.00".
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "—";
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`;
}

/** Token in→out summary (e.g. "12k→1.5k"). */
export function formatTokens(tokensIn: number, tokensOut: number): string {
  return `${(tokensIn / 1000).toFixed(0)}k→${(tokensOut / 1000).toFixed(1)}k`;
}
