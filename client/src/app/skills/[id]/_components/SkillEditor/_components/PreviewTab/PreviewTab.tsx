/* PreviewTab — renders the skill body as the reviewing agent will receive it. */
"use client";

import React from "react";
import { Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";

export function PreviewTab({ skill }: { skill: Skill }) {
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Preview</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          Rendered as the reviewing agent receives it.
        </p>
      </div>
      <div
        style={{
          padding: 20,
          borderRadius: 7,
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          fontSize: 14,
          color: "var(--text-primary)",
          lineHeight: 1.6,
        }}
      >
        <Markdown>{skill.body}</Markdown>
      </div>
    </div>
  );
}
