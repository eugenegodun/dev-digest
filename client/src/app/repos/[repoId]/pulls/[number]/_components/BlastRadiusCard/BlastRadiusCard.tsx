/* BlastRadiusCard — renders the PR BRIEF blast-radius section on the Overview tab.
   Phase 2: stat row (symbols / callers / endpoints / crons) + per-symbol downstream list.
   Reads from the shared `usePrBrief` hook; uses the "blast" i18n namespace for stat
   labels and the "brief" namespace for the block title. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { usePrBrief } from "@/lib/hooks/brief";
import type { BlastRadius, DownstreamImpact, ChangedSymbol } from "@devdigest/shared";
import { s } from "./styles";

// ---- helpers ----

function totalCallers(downstream: DownstreamImpact[]): number {
  return downstream.reduce((sum, d) => sum + d.callers.length, 0);
}

function totalEndpoints(downstream: DownstreamImpact[]): number {
  const unique = new Set(downstream.flatMap((d) => d.endpoints_affected));
  return unique.size;
}

function totalCrons(downstream: DownstreamImpact[]): number {
  const unique = new Set(downstream.flatMap((d) => d.crons_affected));
  return unique.size;
}

function findChangedSymbol(
  changed: ChangedSymbol[],
  symbolName: string,
): ChangedSymbol | undefined {
  return changed.find((c) => c.name === symbolName);
}

// ---- sub-components ----

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div style={s.statItem}>
      <span style={s.statValue}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

function TagList({ items, ariaLabel }: { items: string[]; ariaLabel: string }) {
  if (items.length === 0) return null;
  return (
    <div style={s.tagList} aria-label={ariaLabel}>
      {items.map((item) => (
        <span key={item} style={s.tag}>
          {item}
        </span>
      ))}
    </div>
  );
}

function DownstreamEntry({
  impact,
  changed,
  isLast,
}: {
  impact: DownstreamImpact;
  changed: ChangedSymbol[];
  isLast: boolean;
}) {
  const meta = findChangedSymbol(changed, impact.symbol);
  const containerStyle = isLast ? s.downstreamItemLast : s.downstreamItem;

  return (
    <div style={containerStyle}>
      <div style={s.symbolRow}>
        <span style={s.symbolName}>{impact.symbol}</span>
        {meta && <span style={s.symbolKind}>{meta.kind}</span>}
      </div>
      {meta && <span style={s.symbolFile}>{meta.file}</span>}

      {impact.callers.length > 0 && (
        <ul style={s.callerList} aria-label={`Callers of ${impact.symbol}`}>
          {impact.callers.map((caller) => (
            <li key={`${caller.file}:${caller.line}:${caller.name}`} style={s.callerItem}>
              {caller.name} — {caller.file}:{caller.line}
            </li>
          ))}
        </ul>
      )}

      <TagList items={impact.endpoints_affected} ariaLabel={`Endpoints affected by ${impact.symbol}`} />
      <TagList items={impact.crons_affected} ariaLabel={`Crons affected by ${impact.symbol}`} />
    </div>
  );
}

function BlastBody({ blast }: { blast: BlastRadius }) {
  const t = useTranslations("blast");
  const { changed_symbols, downstream } = blast;
  const hasDownstream = downstream.length > 0;

  return (
    <>
      <div style={s.statRow}>
        <StatItem value={changed_symbols.length} label={t("stat.symbols")} />
        <StatItem value={totalCallers(downstream)} label={t("stat.callers")} />
        <StatItem value={totalEndpoints(downstream)} label={t("stat.endpoints")} />
        <StatItem value={totalCrons(downstream)} label={t("stat.crons")} />
      </div>

      <div style={s.body}>
        {hasDownstream ? (
          downstream.map((impact, idx) => (
            <DownstreamEntry
              key={impact.symbol}
              impact={impact}
              changed={changed_symbols}
              isLast={idx === downstream.length - 1}
            />
          ))
        ) : (
          <p style={s.noDownstreamText}>
            {t("noDownstream", { count: changed_symbols.length })}
          </p>
        )}
      </div>
    </>
  );
}

function UnavailableBody() {
  const t = useTranslations("brief");
  return (
    <div style={s.unavailableWrap}>
      <span style={s.unavailableText}>{t("unavailable")}</span>
    </div>
  );
}

function LoadingBody() {
  return (
    <div style={s.body}>
      <div style={s.skeletonLine("60%")} />
      <div style={s.skeletonLine("80%")} />
      <div style={s.skeletonLine("50%")} />
    </div>
  );
}

// ---- component ----

export function BlastRadiusCard({ prId }: { prId: string | null | undefined }) {
  const t = useTranslations("brief");
  const { data, isLoading } = usePrBrief(prId);

  const blast = data?.blast;
  const hasBlast =
    blast != null &&
    (blast.changed_symbols.length > 0 ||
      blast.downstream.length > 0 ||
      blast.summary.trim().length > 0);

  return (
    <div style={s.card} aria-label={t("block.blast")}>
      <div style={s.header}>
        <span style={s.headerTitle}>{t("block.blast")}</span>
      </div>

      {isLoading && <LoadingBody />}
      {!isLoading && !hasBlast && <UnavailableBody />}
      {!isLoading && hasBlast && <BlastBody blast={blast} />}
    </div>
  );
}
