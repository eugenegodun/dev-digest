import type { IconName } from "@devdigest/ui";

export interface EditorTab {
  key: string;
  label: string;
  icon: IconName;
}

/** Skill editor tabs. Phase 5 ships Config only; Preview/Stats/Versions are Phase 6. */
export const TABS: readonly EditorTab[] = [
  { key: "config", label: "Config", icon: "Settings" },
  { key: "preview", label: "Preview", icon: "Eye" },
  { key: "stats", label: "Stats", icon: "BarChart" },
  { key: "versions", label: "Versions", icon: "History" },
];

export const VALID_TABS = TABS.map((t) => t.key);
