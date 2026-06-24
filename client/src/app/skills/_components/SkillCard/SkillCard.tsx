/* SkillCard — name, type badge, source badge, enabled toggle, token count. */
"use client";

import React from "react";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill } from "@/lib/hooks/skills";
import { TYPE_COLORS, SOURCE_ICONS, SOURCE_LABELS } from "./constants";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const del = useDeleteSkill();
  const typeColor = TYPE_COLORS[skill.type];
  const SourceIcon = SOURCE_ICONS[skill.source];
  const sourceLabel = SOURCE_LABELS[skill.source];

  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={14} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete skill "${skill.name}"? This cannot be undone.`)) del.mutate(skill.id);
          }}
          disabled={del.isPending}
          title="Delete skill"
          aria-label="Delete skill"
          style={{
            background: "none",
            border: "none",
            cursor: del.isPending ? "not-allowed" : "pointer",
            color: "var(--text-muted)",
            display: "inline-flex",
            padding: 4,
          }}
        >
          <Icon.Trash
            size={14}
            style={del.isPending ? { animation: "ddspin 1s linear infinite" } : undefined}
          />
        </button>
      </div>
      <div style={s.description}>{skill.description || "No description"}</div>
      <div style={s.metaRow}>
        <Badge color={typeColor.text} bg={typeColor.bg}>
          {skill.type}
        </Badge>
        <Badge color="var(--text-secondary)" icon={SourceIcon}>
          {sourceLabel}
        </Badge>
        <span className="mono" style={s.tokenChip}>
          ~{skill.body_tokens} tok
        </span>
      </div>
    </div>
  );
}
