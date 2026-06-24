/* SkillEditor — tabbed editor shell (Config, Preview, Stats, Versions). */
"use client";

import React from "react";
import { Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { StatsTab } from "./_components/StatsTab";
import { VersionsTab } from "./_components/VersionsTab";
import { TABS } from "./constants";
import { s } from "./styles";

export function SkillEditor({
  skill,
  tab,
  onTab,
}: {
  skill: Skill;
  tab: string;
  onTab: (t: string) => void;
}) {
  const tabs = TABS.map((tb) => ({ key: tb.key, label: tb.label, icon: tb.icon }));

  let body: React.ReactNode;
  if (tab === "config") {
    body = <ConfigTab skill={skill} />;
  } else if (tab === "preview") {
    body = <PreviewTab skill={skill} />;
  } else if (tab === "stats") {
    body = <StatsTab skillId={skill.id} />;
  } else if (tab === "versions") {
    body = <VersionsTab skill={skill} />;
  } else {
    body = <div style={s.placeholder}>This tab is available in a future release.</div>;
  }

  return (
    <div style={s.wrap}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>{body}</div>
    </div>
  );
}
