/**
 * blast-mapper.ts — pure mapping function, no LLM, no new DB queries.
 *
 * Converts repo-intel's `BlastResult` (from `getBlastRadius`) into the shared
 * contract `BlastRadius { changed_symbols, downstream, summary }`.
 *
 * Two paths:
 *
 * PERSISTENT path (`degraded === false`, `factsByFile` is present):
 *   - `downstream` entries each carry `endpoints_affected` and `crons_affected`
 *     attributed per caller file via `factsByFile` from the persistent index.
 *
 * DEGRADED path (`degraded === true`, `factsByFile` absent — ripgrep/unindexed):
 *   - Repo Intel degrades silently when the repo index is absent (see INSIGHTS.md:
 *     "an unindexed repo degrades silently to diff-only").
 *   - `crons_affected` MUST be `[]` — cron facts only exist in the persistent
 *     `file_facts` table and are never available on the ripgrep path.
 *   - `endpoints_affected` falls back to the flat `impactedEndpoints` list from
 *     `BlastResult` (not attributed per symbol; each impact entry gets the union).
 */

import type { BlastResult } from '../repo-intel/types.js';
import type { BlastRadius } from '../../vendor/shared/contracts/brief.js';

/**
 * Map a `BlastResult` into the `BlastRadius` contract.
 *
 * @param blastResult - The raw result from `RepoIntel.getBlastRadius(...)`.
 * @returns A fully valid `BlastRadius` object (passes the Zod schema).
 */
export function mapBlastRadius(blastResult: BlastResult): BlastRadius {
  const { changedSymbols, callers, impactedEndpoints, factsByFile, degraded } = blastResult;

  // changed_symbols: BlastChangedSymbol and ChangedSymbol share the same field names.
  const changed_symbols = changedSymbols.map((s) => ({
    name: s.name,
    file: s.file,
    kind: s.kind,
  }));

  // Group BlastCallerRows by the changed symbol they reach (via viaSymbol).
  const callersBySymbol = new Map<string, typeof callers>();
  for (const caller of callers) {
    const group = callersBySymbol.get(caller.viaSymbol);
    if (group) {
      group.push(caller);
    } else {
      callersBySymbol.set(caller.viaSymbol, [caller]);
    }
  }

  // Whether we have per-file endpoint/cron facts (persistent index path only).
  const isPersistent = !degraded && factsByFile !== undefined;

  // Build downstream: one DownstreamImpact per changed symbol that has callers.
  // Symbols with no callers are omitted (no downstream impact to report).
  const downstream = changed_symbols
    .filter((sym) => callersBySymbol.has(sym.name))
    .map((sym) => {
      const symCallers = callersBySymbol.get(sym.name) ?? [];

      // BlastCallerRow.symbol → BlastCaller.name; file and line pass through.
      const mappedCallers = symCallers.map((c) => ({
        name: c.symbol,
        file: c.file,
        line: c.line,
      }));

      if (isPersistent && factsByFile) {
        // PERSISTENT path: join factsByFile on each caller file to get attributed
        // endpoints and crons for this specific changed symbol's callers.
        const endpointSet = new Set<string>();
        const cronSet = new Set<string>();
        for (const caller of symCallers) {
          const facts = factsByFile[caller.file];
          if (facts) {
            for (const e of facts.endpoints) endpointSet.add(e);
            for (const cr of facts.crons) cronSet.add(cr);
          }
        }
        return {
          symbol: sym.name,
          callers: mappedCallers,
          endpoints_affected: [...endpointSet],
          crons_affected: [...cronSet],
        };
      } else {
        // DEGRADED path: crons not available on the ripgrep path — always [].
        // Endpoints fall back to the flat union from impactedEndpoints.
        return {
          symbol: sym.name,
          callers: mappedCallers,
          endpoints_affected: [...impactedEndpoints],
          crons_affected: [] as string[],
        };
      }
    });

  // Summary: deterministic template string — no LLM involved.
  const symbolCount = changed_symbols.length;
  const callerCount = callers.length;
  const endpointCount = downstream.reduce((acc, d) => acc + d.endpoints_affected.length, 0);
  const summary = `${symbolCount} symbol${symbolCount !== 1 ? 's' : ''}, ${callerCount} caller${callerCount !== 1 ? 's' : ''}, ${endpointCount} endpoint${endpointCount !== 1 ? 's' : ''}`;

  return { changed_symbols, downstream, summary };
}
