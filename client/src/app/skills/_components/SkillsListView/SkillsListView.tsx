/* /skills — Skills list view. SkillCards + create. Selecting a skill navigates
   to the editor at /skills/:id. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Dropdown, EmptyState, ErrorState, Skeleton, Icon } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { CreateSkillModal } from "./_components/CreateSkillModal";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsListView() {
  const router = useRouter();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [creating, setCreating] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const list = filterSkills(skills ?? [], search);

  return (
    <AppShell crumb={[{ label: "Skills Lab" }, { label: "Skills" }]}>
      {creating && <CreateSkillModal onClose={() => setCreating(false)} />}
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>Skills</h1>
            <p style={s.subtitle}>Reusable review instructions attached to agents.</p>
          </div>
          <div style={s.search}>
            <Icon.Search size={13} style={s.searchIcon} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter skills…"
              style={s.searchInput}
            />
          </div>
          <Dropdown
            width={220}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                Add Skill
              </Button>
            }
            items={[
              { label: "Create from scratch", icon: "Edit", onClick: () => setCreating(true) },
              { divider: true },
              { label: "Import from file…", icon: "Upload", muted: true, onClick: () => setCreating(true) },
            ]}
          />
        </div>

        {isLoading && (
          <div style={s.grid}>
            <Skeleton height={120} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </div>
        )}
        {isError && <ErrorState body="Failed to load skills." onRetry={() => refetch()} />}
        {!isLoading && !isError && list.length === 0 && (
          <EmptyState
            icon="Sparkles"
            title="No skills yet"
            body="Skills are reusable review instructions you can attach to review agents."
            cta="Create a skill"
            onCta={() => setCreating(true)}
          />
        )}
        {list.length > 0 && (
          <div style={s.grid}>
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                onClick={() => router.push(`/skills/${sk.id}?tab=config`)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
