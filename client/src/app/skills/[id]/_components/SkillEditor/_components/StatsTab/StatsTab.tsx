/* StatsTab — skill usage stats: agent links + "not yet tracked" placeholders. */
"use client";

import React from "react";
import { Badge, Skeleton, ErrorState } from "@devdigest/ui";
import { useSkillStats } from "@/lib/hooks/skills";

export function StatsTab({ skillId }: { skillId: string }) {
  const { data: stats, isLoading, isError, refetch } = useSkillStats(skillId);

  if (isLoading) {
    return (
      <div style={{ maxWidth: 760 }}>
        <Skeleton height={80} style={{ marginBottom: 16 }} />
        <Skeleton height={200} />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <ErrorState
        title="Failed to load stats"
        body="Could not fetch skill usage stats."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Stats</h2>
      </div>

      {/* Used by card */}
      <div style={cardStyle}>
        <div style={{ fontSize: 36, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
          {stats.used_by_count}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>agents</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Used by</div>
      </div>

      {/* Agents list */}
      {stats.agents.length > 0 && (
        <div style={{ marginTop: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
            Agents using this skill
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.agents.map((agent) => (
              <a
                key={agent.id}
                href={`/agents/${agent.id}?tab=config`}
                style={agentRowStyle}
              >
                <span style={{ fontSize: 14, color: "var(--text-primary)", flex: 1 }}>
                  {agent.name}
                </span>
                <Badge
                  color={agent.enabled ? "var(--ok)" : "var(--text-muted)"}
                  bg={agent.enabled ? "var(--ok-bg, rgba(34,197,94,0.12))" : "var(--bg-hover)"}
                >
                  {agent.enabled ? "enabled" : "disabled"}
                </Badge>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Not-yet-tracked cards */}
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, marginTop: stats.agents.length > 0 ? 0 : 20 }}>
        Additional metrics
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {NOT_YET_TRACKED.map(({ label }) => (
          <div key={label} style={placeholderCardStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Not yet tracked</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const NOT_YET_TRACKED = [
  { label: "Pull frequency" },
  { label: "Accept rate" },
  { label: "Findings by category" },
];

import type { CSSProperties } from "react";

const cardStyle: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  padding: "16px 20px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  minWidth: 120,
};

const agentRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  textDecoration: "none",
  color: "inherit",
  cursor: "pointer",
};

const placeholderCardStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
};
