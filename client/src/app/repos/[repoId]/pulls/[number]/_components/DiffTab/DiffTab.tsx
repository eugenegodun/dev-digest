"use client";

import React from "react";
import { SectionLabel, Button } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi } from "@/components/diff-viewer";
import { usePrComments, useCreatePrComment, usePrReviews } from "@/lib/hooks/reviews";
import { usePrSmartDiff } from "@/lib/hooks/brief";
import { SmartDiffView } from "../SmartDiffView/SmartDiffView";
import { notify } from "@/lib/toast";
import type { PrFile } from "@devdigest/shared";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  /** Inline commenting is offered only on open PRs (GitHub rejects otherwise). */
  canComment?: boolean;
}

/** Segmented toggle between "Smart order" and "Original order" diff views. */
function DiffOrderToggle({
  value,
  onChange,
}: {
  value: "smart" | "original";
  onChange: (v: "smart" | "original") => void;
}) {
  const baseStyle: React.CSSProperties = {
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 5,
    border: "none",
    cursor: "pointer",
    transition: "background .12s, color .12s",
  };
  const activeStyle: React.CSSProperties = {
    ...baseStyle,
    background: "var(--accent)",
    color: "#fff",
  };
  const inactiveStyle: React.CSSProperties = {
    ...baseStyle,
    background: "transparent",
    color: "var(--text-muted)",
  };

  return (
    <div
      role="group"
      aria-label="Diff order"
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid var(--border)",
        borderRadius: 7,
        overflow: "hidden",
        gap: 0,
      }}
    >
      <button
        type="button"
        aria-pressed={value === "smart"}
        style={value === "smart" ? activeStyle : inactiveStyle}
        onClick={() => onChange("smart")}
      >
        Smart order
      </button>
      <button
        type="button"
        aria-pressed={value === "original"}
        style={value === "original" ? activeStyle : inactiveStyle}
        onClick={() => onChange("original")}
      >
        Original order
      </button>
    </div>
  );
}

export function DiffTab({ prId, filesCount, files, canComment }: DiffTabProps) {
  const { data: comments } = usePrComments(prId);
  const create = useCreatePrComment(prId);
  // Comments start hidden so the diff is clean by default — toggle to reveal.
  const [showComments, setShowComments] = React.useState(false);

  // Smart/Original toggle — defaults to Smart order.
  const [diffOrder, setDiffOrder] = React.useState<"smart" | "original">("smart");

  // Smart diff data — always fetched when Smart order is selected and prId is known.
  const {
    data: smartDiff,
    isLoading: smartDiffLoading,
    isError: smartDiffError,
  } = usePrSmartDiff(diffOrder === "smart" ? prId : null);

  // Reviews for per-finding severity coloring in SmartDiffView.
  const { data: reviews = [] } = usePrReviews(diffOrder === "smart" ? prId : null);

  const commentCount = comments?.length ?? 0;

  const commenting: DiffCommentApi = {
    comments: comments ?? [],
    canComment: !!canComment && !!prId,
    showComments,
    posting: create.isPending,
    onSubmit: async (input) => {
      try {
        const res = await create.mutateAsync(input);
        setShowComments(true); // a just-posted comment shouldn't stay hidden
        return res;
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Couldn't post the comment to GitHub.");
        throw err;
      }
    },
  };

  // Fall back to Original order when smart diff errored.
  const showSmartDiff = diffOrder === "smart" && !smartDiffError;

  return (
    <section>
      <SectionLabel
        icon="Code"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DiffOrderToggle value={diffOrder} onChange={setDiffOrder} />
            {commentCount > 0 && (
              <Button
                kind="ghost"
                size="sm"
                icon={showComments ? "EyeOff" : "Eye"}
                onClick={() => setShowComments((v) => !v)}
              >
                {showComments ? "Hide comments" : "Show comments"} ({commentCount})
              </Button>
            )}
          </div>
        }
      >
        Files changed · {filesCount} files
      </SectionLabel>

      {showSmartDiff ? (
        <SmartDiffView
          smartDiff={smartDiff}
          isLoading={smartDiffLoading}
          prFiles={files}
          reviews={reviews}
        />
      ) : (
        <DiffViewer files={files} commenting={commenting} />
      )}
    </section>
  );
}
