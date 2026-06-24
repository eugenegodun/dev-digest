/* IntentCard — renders the PR BRIEF intent section on the Overview tab.
   Phase 1: intent statement + in_scope + out_of_scope lists.
   blast/risks/history are empty-but-valid in Phase 1 and not rendered here. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { usePrBrief } from "@/lib/hooks/brief";
import { s } from "./styles";
import type { Intent } from "@devdigest/shared";

// ---- helpers ----

function ScopeList({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={s.sectionLabel}>{label}</div>
      <ul style={s.scopeList} aria-label={label}>
        {items.map((item) => (
          <li key={item} style={s.scopeItem}>
            <span style={s.scopeBullet} aria-hidden="true">–</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntentBody({ intent }: { intent: Intent }) {
  return (
    <div style={s.body}>
      <p style={s.intentStatement}>{intent.intent}</p>
      <ScopeList items={intent.in_scope} label="IN SCOPE" />
      <ScopeList items={intent.out_of_scope} label="OUT OF SCOPE" />
    </div>
  );
}

function UnavailableBody() {
  const t = useTranslations("brief");
  return (
    <div style={s.unavailableWrap}>
      <span style={s.unavailableText}>{t("unavailable")}</span>
      <span style={s.unavailableHint}>{t("unavailableHint")}</span>
    </div>
  );
}

function LoadingBody() {
  return (
    <div style={s.body}>
      <div style={s.skeletonLine("80%")} />
      <div style={s.skeletonLine("60%")} />
      <div style={s.skeletonLine("40%")} />
    </div>
  );
}

// ---- component ----

export function IntentCard({ prId }: { prId: string | null | undefined }) {
  const t = useTranslations("brief");
  const { data, isLoading } = usePrBrief(prId);

  const hasIntent =
    data?.intent &&
    (data.intent.intent.trim().length > 0 ||
      data.intent.in_scope.length > 0 ||
      data.intent.out_of_scope.length > 0);

  return (
    <div style={s.card} aria-label={t("block.intent")}>
      <div style={s.header}>
        <span style={s.headerTitle}>{t("block.intent")}</span>
      </div>

      {isLoading && <LoadingBody />}
      {!isLoading && !hasIntent && <UnavailableBody />}
      {!isLoading && hasIntent && <IntentBody intent={data!.intent} />}
    </div>
  );
}
