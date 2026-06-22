/* SkillEditor — tabbed editor shell (Config, Preview, Stats, Versions).
   Phase 5: Config tab only. */
"use client";

import React from "react";
import { Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
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

  const body =
    tab === "config" ? (
      <ConfigTab skill={skill} />
    ) : (
      <div style={s.placeholder}>This tab is available in a future release.</div>
    );

  return (
    <div style={s.wrap}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>{body}</div>
    </div>
  );
}
