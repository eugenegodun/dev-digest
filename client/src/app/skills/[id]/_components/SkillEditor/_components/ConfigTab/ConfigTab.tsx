/* ConfigTab — name, description, type, enabled, body editor with line numbers
   and token count. */
"use client";

import React from "react";
import { FormField, TextInput, SelectInput, Toggle, Button } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SKILL_TYPE_OPTIONS } from "./constants";
import { s } from "./styles";

export function ConfigTab({ skill }: { skill: Skill }) {
  const toast = useToast();
  const update = useUpdateSkill();

  const [name, setName] = React.useState(skill.name);
  const [description, setDescription] = React.useState(skill.description);
  const [type, setType] = React.useState<SkillType>(skill.type);
  const [enabled, setEnabled] = React.useState(skill.enabled);
  const [body, setBody] = React.useState(skill.body);

  // Reset when switching skills
  React.useEffect(() => {
    setName(skill.name);
    setDescription(skill.description);
    setType(skill.type);
    setEnabled(skill.enabled);
    setBody(skill.body);
  }, [skill.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lineCount = body.split("\n").length;
  const isBodyDirty = body !== skill.body;

  // Token estimate: use saved count when clean, client estimate when dirty
  const tokenDisplay = isBodyDirty
    ? "~" + Math.ceil(body.length / 4) + " tok"
    : skill.body_tokens + " tok";

  const save = () =>
    update.mutate(
      { id: skill.id, patch: { name, description, type, enabled, body } },
      {
        onSuccess: (data) =>
          toast.success(`Skill saved (v${data.version})`),
      },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>Configuration</h2>
        <label style={s.enabledLabel}>
          Enabled
          <Toggle on={enabled} onChange={setEnabled} size={16} />
        </label>
      </div>

      <FormField label="Name" required>
        <TextInput value={name} onChange={setName} />
      </FormField>

      <FormField label="Description — phrase directively">
        <TextInput value={description} onChange={setDescription} placeholder="e.g. Enforce X across all files." />
      </FormField>

      <FormField label="Type">
        <SelectInput
          value={type}
          onChange={(v) => setType(v as SkillType)}
          options={[...SKILL_TYPE_OPTIONS]}
        />
      </FormField>

      {/* Body editor with line-numbered gutter */}
      <FormField label="Body">
        <div style={s.editorWrap}>
          {/* Header bar */}
          <div style={s.editorHeader}>
            <span className="mono" style={s.editorFilename}>
              {name || "skill"}.md
            </span>
            <span className="mono" style={s.tokenChip}>
              {tokenDisplay}
            </span>
            {isBodyDirty && <span style={s.unsaved}>Unsaved</span>}
          </div>
          {/* Gutter + textarea */}
          <div style={s.editorBody}>
            <div style={s.gutter} aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} style={s.lineNumber}>
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              style={s.textarea}
              rows={Math.max(12, lineCount + 2)}
            />
          </div>
        </div>
      </FormField>

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
        {update.isSuccess && (
          <span style={s.savedNote}>Saved (v{update.data?.version})</span>
        )}
      </div>
    </div>
  );
}
