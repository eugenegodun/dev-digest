/* VersionsTab — version history with diff viewer and restore. */
"use client";

import React from "react";
import { Badge, Button, Skeleton, ErrorState } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillVersions, useRestoreSkillVersion } from "@/lib/hooks/skills";
import type { SkillVersionRow } from "@/lib/hooks/skills";

export function VersionsTab({ skill }: { skill: Skill }) {
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skill.id);

  const restore = useRestoreSkillVersion();
  const [diffVersion, setDiffVersion] = React.useState<SkillVersionRow | null>(null);
  const [confirmRestore, setConfirmRestore] = React.useState<SkillVersionRow | null>(null);

  if (isLoading) {
    return (
      <div style={{ maxWidth: 760 }}>
        <Skeleton height={24} style={{ marginBottom: 12 }} />
        <Skeleton height={48} style={{ marginBottom: 8 }} />
        <Skeleton height={48} style={{ marginBottom: 8 }} />
        <Skeleton height={48} />
      </div>
    );
  }

  if (isError || !versions) {
    return (
      <ErrorState
        title="Failed to load versions"
        body="Could not fetch version history."
        onRetry={() => refetch()}
      />
    );
  }

  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const maxVersion = sorted[0]?.version ?? skill.version;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>
          Version history ({versions.length} {versions.length === 1 ? "version" : "versions"})
        </h2>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Each version is an immutable snapshot.
      </p>

      {/* Version rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((v) => {
          const isCurrent = v.version === maxVersion;
          const label = v.note ?? `Version ${v.version}`;
          return (
            <div key={v.version} style={rowStyle}>
              <Badge mono color="var(--text-muted)" bg="var(--bg-hover)">
                v{v.version}
              </Badge>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{label}</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {formatDate(v.created_at)}
              </span>
              {isCurrent && (
                <Badge color="var(--ok)" bg="var(--ok-bg, rgba(34,197,94,0.12))">
                  Current
                </Badge>
              )}
              <Button
                kind="ghost"
                icon="Eye"
                onClick={() => setDiffVersion(v)}
                style={{ marginLeft: 4 }}
              >
                Diff
              </Button>
              {!isCurrent && (
                <Button
                  kind="ghost"
                  icon="RefreshCw"
                  onClick={() => setConfirmRestore(v)}
                  disabled={restore.isPending}
                >
                  Restore
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Diff modal */}
      {diffVersion && (
        <DiffModal
          version={diffVersion}
          currentBody={skill.body}
          onClose={() => setDiffVersion(null)}
        />
      )}

      {/* Confirm restore modal */}
      {confirmRestore && (
        <ConfirmModal
          version={confirmRestore}
          isPending={restore.isPending}
          onConfirm={() => {
            restore.mutate(
              { id: skill.id, version: confirmRestore.version },
              { onSuccess: () => setConfirmRestore(null) },
            );
          }}
          onCancel={() => setConfirmRestore(null)}
        />
      )}
    </div>
  );
}

// ---- Diff modal ----

function DiffModal({
  version,
  currentBody,
  onClose,
}: {
  version: SkillVersionRow;
  currentBody: string;
  onClose: () => void;
}) {
  const oldLines = version.body.split("\n");
  const newLines = currentBody.split("\n");
  const diff = computeLineDiff(oldLines, newLines);

  return (
    <Overlay onClose={onClose}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          v{version.version} → current
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
          {version.note ?? `Version ${version.version}`} vs current body
        </p>
      </div>
      <div
        style={{
          overflow: "auto",
          padding: "16px 24px",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 13,
          lineHeight: 1.6,
          maxHeight: "60vh",
        }}
      >
        {diff.map((line, i) => (
          <div key={i} style={diffLineStyle(line.type)}>
            <span style={{ userSelect: "none", color: "var(--text-muted)", marginRight: 12, minWidth: 16, display: "inline-block" }}>
              {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
            </span>
            {line.text}
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
        <Button kind="secondary" onClick={onClose}>Close</Button>
      </div>
    </Overlay>
  );
}

// ---- Confirm restore modal ----

function ConfirmModal({
  version,
  isPending,
  onConfirm,
  onCancel,
}: {
  version: SkillVersionRow;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <div style={{ padding: "24px", maxWidth: 400 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          Restore v{version.version}?
        </h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
          This writes the old body as a new version. The current body will not be lost.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button kind="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button kind="primary" icon="RefreshCw" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Restoring…" : "Restore"}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

// ---- Shared overlay ----

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          minWidth: 400,
          maxWidth: 760,
          width: "90vw",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---- Utilities ----

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

type DiffLine = { type: "added" | "removed" | "unchanged"; text: string };

/** Simple line-diff: LCS-based comparison of two line arrays. */
function computeLineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;
  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let r = 1; r <= m; r++) {
    for (let c = 1; c <= n; c++) {
      const prevRow = dp[r - 1];
      const curRow = dp[r];
      if (prevRow === undefined || curRow === undefined) continue;
      if (oldLines[r - 1] === newLines[c - 1]) {
        curRow[c] = (prevRow[c - 1] ?? 0) + 1;
      } else {
        curRow[c] = Math.max(prevRow[c] ?? 0, curRow[c - 1] ?? 0);
      }
    }
  }
  // Backtrack
  const result: DiffLine[] = [];
  let r = m;
  let c = n;
  while (r > 0 || c > 0) {
    const oldLine = oldLines[r - 1];
    const newLine = newLines[c - 1];
    const curRow = dp[r];
    const prevRow = dp[r - 1];
    if (r > 0 && c > 0 && oldLine === newLine && oldLine !== undefined) {
      result.push({ type: "unchanged", text: oldLine });
      r--; c--;
    } else if (
      c > 0 &&
      newLine !== undefined &&
      (r === 0 || (curRow !== undefined && prevRow !== undefined && (curRow[c - 1] ?? 0) >= (prevRow[c] ?? 0)))
    ) {
      result.push({ type: "added", text: newLine });
      c--;
    } else if (r > 0 && oldLine !== undefined) {
      result.push({ type: "removed", text: oldLine });
      r--;
    } else {
      break;
    }
  }
  return result.reverse();
}

function diffLineStyle(type: DiffLine["type"]): React.CSSProperties {
  if (type === "added") {
    return { background: "rgba(34,197,94,0.10)", color: "var(--ok, #22c55e)", padding: "0 4px", borderLeft: "3px solid var(--ok, #22c55e)" };
  }
  if (type === "removed") {
    return { background: "rgba(239,68,68,0.10)", color: "var(--crit, #ef4444)", padding: "0 4px", borderLeft: "3px solid var(--crit, #ef4444)" };
  }
  return { padding: "0 4px", borderLeft: "3px solid transparent", color: "var(--text-secondary)" };
}

import type { CSSProperties } from "react";

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
};
