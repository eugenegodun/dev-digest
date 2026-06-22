import type { SkillType } from "@devdigest/shared";

/** Default skill type for new skills. */
export const DEFAULT_TYPE: SkillType = "rubric";

/** Selectable skill types. */
export const SKILL_TYPE_OPTIONS: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Modal width (px). */
export const MODAL_WIDTH = 620;
