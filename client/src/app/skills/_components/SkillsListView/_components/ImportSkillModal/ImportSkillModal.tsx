"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, FormField, SelectInput } from "@devdigest/ui";
import type { SkillType, SkillSource } from "@devdigest/shared";
import { useImportSkillPreview, useCreateSkill } from "@/lib/hooks/skills";
import { MODAL_WIDTH, SKILL_TYPE_OPTIONS } from "./constants";
import { s } from "./styles";

/**
 * ImportSkillModal — file picker (.md/.zip) → preview → confirm save.
 *
 * Flow:
 *   1. User picks a file; client POSTs to /skills/import/preview (multipart).
 *   2. Server extracts name/description/type/body + ignored_files list.
 *   3. User reviews the preview (read-only body, trust note, ignored list).
 *   4. On "Save": POST /skills with source=extracted|imported_url, navigate to editor.
 */
export function ImportSkillModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const preview = useImportSkillPreview();
  const create = useCreateSkill();

  // Preview state (populated after upload)
  const [previewData, setPreviewData] = React.useState<{
    name: string;
    description: string;
    type: SkillType;
    body: string;
    ignored_files: string[];
    source: SkillSource;
  } | null>(null);

  const [fileError, setFileError] = React.useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setPreviewData(null);

    try {
      const result = await preview.mutateAsync(file);
      const isZip = file.name.toLowerCase().endsWith(".zip");
      setPreviewData({
        name: result.name,
        description: result.description,
        type: (result.type as SkillType) || "custom",
        body: result.body,
        ignored_files: result.ignored_files,
        source: isZip ? "extracted" : "imported_url",
      });
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to parse file.");
    }
  };

  const handleSave = async () => {
    if (!previewData) return;
    const skill = await create.mutateAsync({
      name: previewData.name || "Imported Skill",
      description: previewData.description,
      type: previewData.type,
      source: previewData.source,
      body: previewData.body,
      enabled: true,
    });
    onClose();
    router.push(`/skills/${skill.id}?tab=config`);
  };

  const canSave = !!previewData && !create.isPending;

  return (
    <Modal
      width={MODAL_WIDTH}
      title="Import Skill"
      subtitle="Import a skill from a .md or .zip file."
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            kind="primary"
            icon="Upload"
            onClick={handleSave}
            disabled={!canSave}
          >
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        {/* File picker */}
        <FormField label="Select file (.md or .zip)">
          <input
            type="file"
            accept=".md,.zip"
            onChange={handleFileChange}
            style={s.fileInput}
          />
        </FormField>

        {preview.isPending && <p style={s.hint}>Parsing file…</p>}
        {fileError && <p style={s.error}>{fileError}</p>}

        {/* Preview pane */}
        {previewData && (
          <div style={s.previewSection}>
            <div style={s.trustNote}>
              ⚠️ An imported skill becomes instructions in the agent&apos;s prompt.
              Review the body carefully before saving.
            </div>

            <FormField label="Name">
              <div style={s.readonlyField}>{previewData.name || <span style={s.empty}>(none)</span>}</div>
            </FormField>

            <FormField label="Description">
              <div style={s.readonlyField}>
                {previewData.description || <span style={s.empty}>(none)</span>}
              </div>
            </FormField>

            <FormField label="Type">
              <SelectInput
                value={previewData.type}
                onChange={(v) =>
                  setPreviewData((prev) => prev && { ...prev, type: v as SkillType })
                }
                options={[...SKILL_TYPE_OPTIONS]}
              />
            </FormField>

            <FormField label="Body (Markdown)">
              <textarea
                value={previewData.body}
                readOnly
                rows={10}
                style={s.bodyTextarea}
              />
            </FormField>

            {previewData.ignored_files.length > 0 && (
              <FormField label="Ignored files (not imported)">
                <ul style={s.ignoredList}>
                  {previewData.ignored_files.map((f) => (
                    <li key={f} style={s.ignoredItem}>
                      {f}
                    </li>
                  ))}
                </ul>
              </FormField>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
