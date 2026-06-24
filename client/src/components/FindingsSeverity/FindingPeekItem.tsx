/* FindingPeekItem — one read-only finding row in the peek popover: severity
   badge, title + category, file:line + confidence, and a 2-line rationale
   preview. The full FindingCard (with accept/dismiss + markdown) lives on the
   PR detail page; the peek is intentionally lightweight and non-interactive. */
"use client";

import React from "react";
import { SeverityBadge, CategoryTag, ConfidenceNum, type Severity, type Category } from "@devdigest/ui";
import type { Finding } from "@/lib/types";

export function FindingPeekItem({ f }: { f: Finding }) {
  const line = f.start_line === f.end_line ? `${f.start_line}` : `${f.start_line}-${f.end_line}`;
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 12px", borderTop: "1px solid var(--border)" }}>
      <div style={{ flexShrink: 0, paddingTop: 1 }}>
        <SeverityBadge severity={f.severity as Severity} compact />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.title}</span>
          <CategoryTag category={f.category as Category} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--accent-text)" }}>
            {f.file}:{line}
          </span>
          <ConfidenceNum value={f.confidence} />
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12.5,
            color: "var(--text-secondary)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {f.rationale}
        </div>
      </div>
    </div>
  );
}
