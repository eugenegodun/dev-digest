/* SmartDiffView — renders the reviewer-ordered diff inside the Files-changed tab.
   Files are grouped core → wiring → boilerplate; boilerplate is collapsed by default.
   Files with findings carry a severity-colored "N findings" badge. Clicking the badge
   expands the file and scrolls to the first flagged line. Per-line severity markers
   appear on every flagged line. A split-suggestion banner appears when the core change
   is too large.

   Data inputs:
   - smartDiff  — from usePrSmartDiff (groups + split_suggestion)
   - prFiles    — from usePullDetail (for patch lookup by path)
   - reviews    — from usePrReviews (newest-first, for per-file severity coloring)
*/
"use client";

import React from "react";
import { Icon } from "@devdigest/ui";
import type { SmartDiff, SmartDiffFile, SmartDiffGroup, SmartDiffRole } from "@devdigest/shared";
import type { ReviewRecord } from "@devdigest/shared";
import type { PrFile } from "@/lib/types";
import { parsePatch, type Line } from "@/components/diff-viewer/helpers";
import {
  SEV_COLOR,
  SEV_COLOR_FALLBACK,
} from "../FindingCard/constants";
import { s, chevronFor } from "./styles";

// ---- Constants ----

const ROLE_ORDER: SmartDiffRole[] = ["core", "wiring", "boilerplate"];

const ROLE_LABEL: Record<SmartDiffRole, string> = {
  core: "CORE LOGIC",
  wiring: "WIRING",
  boilerplate: "BOILERPLATE",
};

const ROLE_DESCRIPTION: Record<SmartDiffRole, string> = {
  core: "The meat of this PR — files containing the primary logic change.",
  wiring: "Configuration, entry points, and integration plumbing.",
  boilerplate: "Lockfiles, snapshots, generated output, and other noise.",
};

/** Severity sort order for determining "highest" severity. */
const SEV_RANK: Record<string, number> = {
  CRITICAL: 3,
  WARNING: 2,
  SUGGESTION: 1,
};

// ---- Helpers ----

/** Return the highest-severity finding for a given file path from the latest review. */
function highestSeverityForFile(
  filePath: string,
  reviews: ReviewRecord[],
): string | null {
  const latest = reviews[0];
  if (!latest) return null;
  const fileFindings = latest.findings.filter((f) => f.file === filePath);
  if (fileFindings.length === 0) return null;
  return fileFindings.reduce<string | null>((best, f) => {
    if (best === null) return f.severity;
    return (SEV_RANK[f.severity] ?? 0) > (SEV_RANK[best] ?? 0) ? f.severity : best;
  }, null);
}

/** Count findings for a given file path in the latest review. */
function findingCountForFile(filePath: string, reviews: ReviewRecord[]): number {
  const latest = reviews[0];
  if (!latest) return 0;
  return latest.findings.filter((f) => f.file === filePath).length;
}

// ---- SmartFileCard ----

/** One file inside the smart diff. Manages open/close state, renders per-line
 *  severity markers, and supports external open-trigger for badge clicks. */
function SmartFileCard({
  smartFile,
  prFile,
  findingLines,
  findingCount,
  highestSeverity,
  initialOpen,
  scrollToFirstFinding,
}: {
  smartFile: SmartDiffFile;
  prFile: PrFile | undefined;
  findingLines: number[];
  findingCount: number;
  highestSeverity: string | null;
  initialOpen: boolean;
  /** Called when the external trigger (badge click) fires — instructs this card
   *  to expand and scroll to the first finding line. */
  scrollToFirstFinding?: React.MutableRefObject<(() => void) | null>;
}) {
  const [open, setOpen] = React.useState(initialOpen);
  const findingLineSet = React.useMemo(() => new Set(findingLines), [findingLines]);
  const firstFindingLine = findingLines[0] ?? null;
  const lineRefs = React.useRef<Map<number, HTMLElement>>(new Map());

  // Register the scroll-to-first-finding trigger so the badge click can call it.
  React.useEffect(() => {
    if (!scrollToFirstFinding) return;
    scrollToFirstFinding.current = () => {
      setOpen(true);
      // Scroll after the next paint so the content is visible.
      requestAnimationFrame(() => {
        if (firstFindingLine !== null) {
          const el = lineRefs.current.get(firstFindingLine);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    };
    return () => {
      scrollToFirstFinding.current = null;
    };
  }, [scrollToFirstFinding, firstFindingLine]);

  const lines = React.useMemo(
    () => parsePatch(prFile?.patch),
    [prFile?.patch],
  );

  const badgeColor = highestSeverity
    ? (SEV_COLOR[highestSeverity] ?? SEV_COLOR_FALLBACK)
    : SEV_COLOR_FALLBACK;

  const hasFindingsBadge = findingCount > 0 && highestSeverity !== null;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 7,
        overflow: "hidden",
        background: "var(--bg-elevated)",
      }}
    >
      {/* File header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
        }}
      >
        <Icon.ChevronRight size={13} style={chevronFor(open)} />
        <Icon.FileText size={14} style={{ color: "var(--text-muted)" }} />
        <span
          className="mono"
          style={{
            fontSize: 13,
            fontWeight: 500,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {smartFile.path}
        </span>
        <span className="mono tnum" style={{ fontSize: 12 }}>
          <span style={{ color: "var(--code-add-text)" }}>
            +{smartFile.additions}
          </span>{" "}
          <span style={{ color: "var(--code-del-text)" }}>
            −{smartFile.deletions}
          </span>
        </span>

        {hasFindingsBadge && (
          <button
            type="button"
            aria-label={`${findingCount} finding${findingCount === 1 ? "" : "s"} — click to expand and jump to first`}
            style={{
              ...s.findingsBadge,
              color: badgeColor,
              background: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${badgeColor} 30%, transparent)`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              requestAnimationFrame(() => {
                if (firstFindingLine !== null) {
                  const el = lineRefs.current.get(firstFindingLine);
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              });
            }}
          >
            {findingCount} {findingCount === 1 ? "finding" : "findings"}
          </button>
        )}

        {smartFile.pseudocode_summary && (
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontStyle: "italic",
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={smartFile.pseudocode_summary}
          >
            {smartFile.pseudocode_summary}
          </span>
        )}
      </div>

      {/* File body */}
      {open && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "8px 0",
            background: "var(--bg-surface)",
          }}
        >
          {lines.length === 0 ? (
            <div
              style={{
                padding: "14px 18px",
                fontSize: 13,
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              No diff text available (binary or unfetched patch).
            </div>
          ) : (
            lines.map((ln, i) => (
              <SmartCodeLine
                key={i}
                ln={ln}
                isFlagged={isLineFlagged(ln, findingLineSet)}
                severity={isLineFlagged(ln, findingLineSet) ? highestSeverity : null}
                onRef={(el) => {
                  const lineNo = ln.newNo ?? ln.oldNo;
                  if (lineNo !== undefined) {
                    if (el) lineRefs.current.set(lineNo, el);
                    else lineRefs.current.delete(lineNo);
                  }
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Whether this parsed line is flagged by a finding. */
function isLineFlagged(ln: Line, findingLineSet: Set<number>): boolean {
  const no = ln.newNo ?? ln.oldNo;
  return no !== undefined && findingLineSet.has(no);
}

// ---- SmartCodeLine ----

/** One rendered diff line with an optional severity marker on flagged lines. */
function SmartCodeLine({
  ln,
  isFlagged,
  severity,
  onRef,
}: {
  ln: Line;
  isFlagged: boolean;
  severity: string | null;
  onRef?: (el: HTMLElement | null) => void;
}) {
  if (ln.kind === "hunk") {
    return (
      <div
        className="mono"
        style={{
          fontSize: 12,
          lineHeight: "20px",
          color: "var(--accent-text)",
          background: "var(--accent-bg)",
          padding: "0 14px",
        }}
        ref={onRef}
      >
        {ln.text}
      </div>
    );
  }

  const sign = ln.kind === "add" ? "+" : ln.kind === "del" ? "−" : "";
  const background =
    ln.kind === "add"
      ? "var(--code-add)"
      : ln.kind === "del"
        ? "var(--code-del)"
        : "transparent";
  const signColor =
    ln.kind === "add"
      ? "var(--code-add-text)"
      : ln.kind === "del"
        ? "var(--code-del-text)"
        : "var(--text-muted)";

  const markerColor = severity
    ? (SEV_COLOR[severity] ?? SEV_COLOR_FALLBACK)
    : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        fontSize: 13,
        lineHeight: "20px",
        background,
        outline: isFlagged && markerColor
          ? `1px solid color-mix(in srgb, ${markerColor} 25%, transparent)`
          : undefined,
      }}
      ref={onRef}
    >
      <span
        className="mono tnum"
        style={{
          width: 44,
          textAlign: "right",
          padding: "0 10px 0 0",
          color: "var(--text-muted)",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {ln.newNo ?? ln.oldNo ?? ""}
      </span>
      <span
        className="mono"
        style={{
          width: 14,
          textAlign: "center",
          color: signColor,
          flexShrink: 0,
        }}
      >
        {sign}
      </span>
      <span
        className="mono"
        style={{
          flex: 1,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "var(--text-primary)",
          paddingRight: 12,
        }}
      >
        {ln.text || " "}
      </span>
      {isFlagged && markerColor && (
        <span
          aria-label={`${severity} finding on this line`}
          title={`${severity} finding`}
          style={{
            ...s.lineSeverityMarker,
            background: markerColor,
            alignSelf: "center",
            marginRight: 8,
          }}
        />
      )}
    </div>
  );
}

// ---- RoleGroup ----

/** One role group (core / wiring / boilerplate) with collapsible file list. */
function RoleGroup({
  group,
  prFiles,
  reviews,
  defaultOpen,
}: {
  group: SmartDiffGroup;
  prFiles: PrFile[];
  reviews: ReviewRecord[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  // Build a path → PrFile lookup once.
  const prFileByPath = React.useMemo(() => {
    const m = new Map<string, PrFile>();
    for (const f of prFiles) m.set(f.path, f);
    return m;
  }, [prFiles]);

  if (group.files.length === 0) {
    return null;
  }

  return (
    <div style={s.group}>
      {/* Group header — click to collapse/expand the whole group. */}
      <div
        style={s.groupHeader}
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
        }}
        aria-label={`${ROLE_LABEL[group.role]} group — ${group.files.length} file${group.files.length === 1 ? "" : "s"}`}
      >
        <Icon.ChevronRight size={13} style={chevronFor(open)} />
        <span style={s.groupTitle}>{ROLE_LABEL[group.role]}</span>
        <span style={s.groupDescription}>{ROLE_DESCRIPTION[group.role]}</span>
        <span style={s.groupFileCount}>
          {group.files.length} {group.files.length === 1 ? "file" : "files"}
        </span>
      </div>

      {open && (
        <div style={s.groupFiles}>
          {group.files.map((smartFile) => {
            const prFile = prFileByPath.get(smartFile.path);
            const findingCount = findingCountForFile(smartFile.path, reviews);
            const highestSev = highestSeverityForFile(smartFile.path, reviews);
            // Use finding_lines directly from the smart diff (server-computed).
            const findingLines = smartFile.finding_lines;

            // core and wiring are expanded by default; boilerplate group files
            // are not (the group itself is collapsed, but individual files within
            // an open group start expanded for core/wiring).
            const fileOpen = group.role !== "boilerplate";

            return (
              <SmartFileCard
                key={smartFile.path}
                smartFile={smartFile}
                prFile={prFile}
                findingLines={findingLines}
                findingCount={findingCount}
                highestSeverity={highestSev}
                initialOpen={fileOpen}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- SplitBanner ----

function SplitBanner({ smartDiff }: { smartDiff: SmartDiff }) {
  const { split_suggestion } = smartDiff;
  if (!split_suggestion.too_big) return null;

  return (
    <div role="alert" style={s.splitBanner} aria-label="Split suggestion">
      <div style={s.splitBannerTitle}>
        <Icon.AlertTriangle size={14} />
        Large core change — consider splitting this PR
      </div>
      <div style={s.splitBannerBody}>
        This PR touches {split_suggestion.total_lines} lines in core files.
        Splitting by directory makes review and bisect easier.
      </div>
      {split_suggestion.proposed_splits.length > 0 && (
        <ul style={s.splitList} aria-label="Proposed splits">
          {split_suggestion.proposed_splits.map((ps) => (
            <li key={ps.name} style={s.splitItem}>
              <Icon.Folder size={12} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
              <span style={s.splitItemName}>{ps.name}</span>
              <span style={{ color: "var(--text-muted)" }}>
                {ps.files.length} {ps.files.length === 1 ? "file" : "files"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- SmartDiffView ----

interface SmartDiffViewProps {
  /** Grouped diff from the smart-diff API. Null while loading. */
  smartDiff: SmartDiff | null | undefined;
  /** Loading state — show skeleton when true. */
  isLoading?: boolean;
  /** Raw PR files from usePullDetail (needed for patch text). */
  prFiles: PrFile[];
  /** Reviews from usePrReviews — newest first. Used for severity coloring. */
  reviews: ReviewRecord[];
}

/** Renders the reviewer-ordered diff with group headers, finding badges,
 *  per-line severity markers, and an optional split-suggestion banner. */
export function SmartDiffView({
  smartDiff,
  isLoading,
  prFiles,
  reviews,
}: SmartDiffViewProps) {
  if (isLoading) {
    return (
      <div style={s.skeletonContainer} aria-label="Loading smart diff">
        <div style={s.skeleton("40%")} />
        <div style={s.skeleton("100%")} />
        <div style={s.skeleton("100%")} />
        <div style={s.skeleton("70%")} />
        <div style={s.skeleton("100%")} />
      </div>
    );
  }

  if (!smartDiff) {
    return (
      <div style={s.unavailableWrap} aria-label="Smart diff unavailable">
        <span style={s.unavailableText}>
          Smart diff is not yet available for this pull request.
        </span>
      </div>
    );
  }

  // Render groups in fixed canonical order (core → wiring → boilerplate).
  const orderedGroups = ROLE_ORDER.map(
    (role) => smartDiff.groups.find((g) => g.role === role) ?? null,
  );

  return (
    <div style={s.container} aria-label="Reviewer-ordered diff">
      <SplitBanner smartDiff={smartDiff} />

      {orderedGroups.map((group) => {
        if (!group) return null;
        return (
          <RoleGroup
            key={group.role}
            group={group}
            prFiles={prFiles}
            reviews={reviews}
            defaultOpen={group.role !== "boilerplate"}
          />
        );
      })}
    </div>
  );
}
