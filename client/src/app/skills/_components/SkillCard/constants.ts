import type { SkillType, SkillSource } from "@devdigest/shared";
import type { IconName } from "@devdigest/ui";

/** Color tokens per skill type (Badge). */
export const TYPE_COLORS: Record<SkillType, { text: string; bg: string }> = {
  rubric: { text: "var(--info)", bg: "var(--info-bg, #0a2540)" },
  convention: { text: "var(--ok)", bg: "var(--ok-bg, #052e1c)" },
  security: { text: "var(--crit)", bg: "var(--crit-bg, #2e0a0a)" },
  custom: { text: "var(--text-secondary)", bg: "var(--bg-hover)" },
};

/** Icon per skill source. */
export const SOURCE_ICONS: Record<SkillSource, IconName> = {
  manual: "Edit",
  extracted: "Folder",
  community: "Globe",
  imported_url: "Link",
};

/** Label per skill source. */
export const SOURCE_LABELS: Record<SkillSource, string> = {
  manual: "Manual",
  extracted: "Extracted",
  community: "Community",
  imported_url: "Imported",
};
