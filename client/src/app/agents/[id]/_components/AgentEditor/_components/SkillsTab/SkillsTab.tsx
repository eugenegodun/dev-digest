/* SkillsTab — attach, reorder, and manage skills linked to an agent.
   Rendered in AgentEditor when tab === "skills". */
"use client";

import React from "react";
import { Icon, Button, Toggle, Badge } from "@devdigest/ui";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import { useAgentSkills, useSkills, useSetAgentSkills } from "../../../../../../../lib/hooks/skills";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A display row: the link + the resolved skill metadata (if available). */
interface SkillRow {
  link: AgentSkillLink;
  skill: Skill | undefined;
}

// ---------------------------------------------------------------------------
// SkillsTab
// ---------------------------------------------------------------------------

/**
 * Manages the skills attached to an agent.
 *
 * NOTE: The current POST /agents/:id/skills endpoint only accepts
 * { skill_ids: string[] } — a flat ordered array. Per-link `enabled` toggling
 * requires the `agent_skills.enabled` column (spec §4 data-model migration) and
 * the SetSkillsBody schema to be extended.
 * TODO: wire the enabled Toggle once that migration lands.
 * For now, toggling enabled is shown as a visual-only affordance with a
 * local-state optimistic update that is NOT persisted to the server.
 */
export function SkillsTab({ agentId }: { agentId: string }) {
  const { data: links = [], isPending: linksLoading } = useAgentSkills(agentId);
  const { data: allSkills = [], isPending: skillsLoading } = useSkills();
  const setSkills = useSetAgentSkills();

  // Local enabled state keyed by skill_id.
  // TODO: replace with server-backed enabled once the migration lands.
  const [enabledMap, setEnabledMap] = React.useState<Record<string, boolean>>({});

  // Sync local enabled state when links change (treat all as enabled by default).
  React.useEffect(() => {
    const m: Record<string, boolean> = {};
    for (const l of links) {
      m[l.skill_id] = enabledMap[l.skill_id] ?? true;
    }
    setEnabledMap(m);
  }, [links]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build an index of all workspace skills by id.
  const skillById = React.useMemo(() => {
    const m = new Map<string, Skill>();
    for (const s of allSkills) m.set(s.id, s);
    return m;
  }, [allSkills]);

  // Sort links by order.
  const sortedLinks: SkillRow[] = React.useMemo(
    () =>
      [...links]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({ link: l, skill: skillById.get(l.skill_id) })),
    [links, skillById],
  );

  const enabledCount = sortedLinks.filter((r) => enabledMap[r.link.skill_id] !== false).length;
  const totalCount = sortedLinks.length;

  // Ordered skill IDs from current sortedLinks (for server calls).
  const currentIds = sortedLinks.map((r) => r.link.skill_id);

  // ---- Actions ----

  const handleToggleEnabled = (skillId: string) => {
    setEnabledMap((prev) => ({ ...prev, [skillId]: !(prev[skillId] ?? true) }));
    // TODO: persist enabled once server supports per-link enabled flag.
  };

  const handleDetach = (skillId: string) => {
    const newIds = currentIds.filter((id) => id !== skillId);
    setSkills.mutate({ agentId, skillIds: newIds });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newIds = [...currentIds];
    const above = newIds[index - 1]!;
    const current = newIds[index]!;
    newIds[index - 1] = current;
    newIds[index] = above;
    setSkills.mutate({ agentId, skillIds: newIds });
  };

  const handleMoveDown = (index: number) => {
    if (index === sortedLinks.length - 1) return;
    const newIds = [...currentIds];
    const current = newIds[index]!;
    const below = newIds[index + 1]!;
    newIds[index] = below;
    newIds[index + 1] = current;
    setSkills.mutate({ agentId, skillIds: newIds });
  };

  const handleAttach = (skillId: string) => {
    const newIds = [...currentIds, skillId];
    setSkills.mutate({ agentId, skillIds: newIds });
  };

  // Skills not yet attached — available to add.
  const attachedSet = new Set(currentIds);
  const availableSkills = allSkills.filter((s) => !attachedSet.has(s.id));

  if (linksLoading || skillsLoading) {
    return <div style={s.wrap}><p style={s.hint}>Loading…</p></div>;
  }

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <span style={s.countBadge}>{enabledCount} of {totalCount} enabled</span>
        </div>
        <p style={s.hint}>Order matters — skills are injected in the listed sequence.</p>
      </div>

      {/* Skill rows */}
      {sortedLinks.length === 0 ? (
        <div style={s.empty}>
          <Icon.Wrench size={28} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>No skills attached yet.</p>
        </div>
      ) : (
        <ul style={s.list}>
          {sortedLinks.map(({ link, skill }, index) => {
            const isEnabled = enabledMap[link.skill_id] ?? true;
            return (
              <li key={link.skill_id} style={s.row}>
                {/* Drag handle (visual cue; full DnD deferred) */}
                <span style={s.dragHandle} title="Drag to reorder (coming soon)">
                  <Icon.Target size={14} style={{ color: "var(--text-muted)" }} />
                </span>

                {/* Up / Down reorder arrows */}
                <div style={s.arrowGroup}>
                  <button
                    type="button"
                    style={s.arrowBtn}
                    disabled={index === 0 || setSkills.isPending}
                    onClick={() => handleMoveUp(index)}
                    title="Move up"
                    aria-label="Move skill up"
                  >
                    <Icon.ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    style={s.arrowBtn}
                    disabled={index === sortedLinks.length - 1 || setSkills.isPending}
                    onClick={() => handleMoveDown(index)}
                    title="Move down"
                    aria-label="Move skill down"
                  >
                    <Icon.ArrowDown size={13} />
                  </button>
                </div>

                {/* Skill name + type badge */}
                <div style={s.skillInfo}>
                  <span style={{ ...s.skillName, opacity: isEnabled ? 1 : 0.45 }}>
                    {skill?.name ?? link.skill_id}
                  </span>
                  {skill?.type && (
                    <Badge color={typeColor(skill.type)} mono>
                      {skill.type}
                    </Badge>
                  )}
                </div>

                {/* Enabled toggle
                    TODO: persist to server once agent_skills.enabled lands */}
                <label style={s.toggleLabel} title="Toggle enabled (local only — server persistence coming soon)">
                  <Toggle on={isEnabled} onChange={() => handleToggleEnabled(link.skill_id)} size={14} />
                </label>

                {/* Detach */}
                <button
                  type="button"
                  style={s.detachBtn}
                  disabled={setSkills.isPending}
                  onClick={() => handleDetach(link.skill_id)}
                  title="Detach skill"
                  aria-label={`Detach ${skill?.name ?? link.skill_id}`}
                >
                  <Icon.X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add skill picker */}
      {availableSkills.length > 0 && (
        <AddSkillSection availableSkills={availableSkills} onAttach={handleAttach} isPending={setSkills.isPending} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddSkillSection — inline picker for attaching a workspace skill
// ---------------------------------------------------------------------------

function AddSkillSection({
  availableSkills,
  onAttach,
  isPending,
}: {
  availableSkills: Skill[];
  onAttach: (id: string) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const filtered = query.trim()
    ? availableSkills.filter(
        (s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.type.includes(query.toLowerCase()),
      )
    : availableSkills;

  return (
    <div style={{ marginTop: 16 }}>
      {!open ? (
        <Button kind="secondary" icon="Plus" size="sm" disabled={isPending} onClick={() => setOpen(true)}>
          Add skill
        </Button>
      ) : (
        <div style={s.picker}>
          <div style={s.pickerHeader}>
            <Icon.Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills…"
              style={s.pickerInput}
            />
            <button type="button" onClick={() => setOpen(false)} style={s.pickerClose} aria-label="Close picker">
              <Icon.X size={13} />
            </button>
          </div>
          <ul style={s.pickerList}>
            {filtered.length === 0 && (
              <li style={{ padding: "8px 12px", fontSize: 13, color: "var(--text-muted)" }}>No matches</li>
            )}
            {filtered.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  style={s.pickerItem}
                  onClick={() => {
                    onAttach(skill.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span style={{ flex: 1 }}>{skill.name}</span>
                  <Badge color={typeColor(skill.type)} mono>
                    {skill.type}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeColor(type: string): string {
  switch (type) {
    case "security":  return "var(--severity-critical, #e53e3e)";
    case "rubric":    return "var(--accent, #7c3aed)";
    case "convention": return "var(--ok, #38a169)";
    default:          return "var(--text-secondary)";
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

import type { CSSProperties } from "react";

const s = {
  wrap: { maxWidth: 680 } satisfies CSSProperties,
  header: { marginBottom: 16 } satisfies CSSProperties,
  countBadge: {
    display: "inline-block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    marginBottom: 4,
  } satisfies CSSProperties,
  hint: {
    margin: 0,
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 0",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
  } satisfies CSSProperties,
  dragHandle: {
    cursor: "grab",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  } satisfies CSSProperties,
  arrowGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flexShrink: 0,
  } satisfies CSSProperties,
  arrowBtn: {
    background: "none",
    border: "none",
    padding: 2,
    cursor: "pointer",
    borderRadius: 4,
    color: "var(--text-secondary)",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
  } satisfies CSSProperties,
  skillInfo: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  } satisfies CSSProperties,
  skillName: {
    fontSize: 14,
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  toggleLabel: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  } satisfies CSSProperties,
  detachBtn: {
    background: "none",
    border: "none",
    padding: 4,
    cursor: "pointer",
    borderRadius: 4,
    color: "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  } satisfies CSSProperties,
  // Add skill picker
  picker: {
    border: "1px solid var(--border-strong)",
    borderRadius: 9,
    background: "var(--bg-elevated)",
    overflow: "hidden",
    maxWidth: 400,
  } satisfies CSSProperties,
  pickerHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  pickerInput: {
    flex: 1,
    fontSize: 13,
    color: "var(--text-primary)",
    background: "transparent",
    border: "none",
    outline: "none",
  } satisfies CSSProperties,
  pickerClose: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    padding: 2,
  } satisfies CSSProperties,
  pickerList: {
    listStyle: "none",
    margin: 0,
    padding: 6,
    maxHeight: 240,
    overflowY: "auto",
  } satisfies CSSProperties,
  pickerItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 13,
    textAlign: "left",
    cursor: "pointer",
  } satisfies CSSProperties,
} as const;
