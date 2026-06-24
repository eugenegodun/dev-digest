"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, FormField, TextInput, SelectInput, Textarea } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useCreateSkill } from "@/lib/hooks/skills";
import { DEFAULT_TYPE, MODAL_WIDTH, SKILL_TYPE_OPTIONS } from "./constants";
import { s } from "./styles";

/** Create-skill modal — name / description / type / body. Source is always 'manual'. */
export function CreateSkillModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>(DEFAULT_TYPE);
  const [body, setBody] = React.useState("");

  const submit = async () => {
    const skill = await create.mutateAsync({
      name: name.trim() || "Untitled Skill",
      description,
      type,
      source: "manual",
      body,
      enabled: true,
    });
    onClose();
    router.push(`/skills/${skill.id}?tab=config`);
  };

  return (
    <Modal
      width={MODAL_WIDTH}
      title="Create Skill"
      subtitle="Define a reusable block of review instructions."
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label="Name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. TypeScript strictness" />
        </FormField>
        <FormField label="Description — phrase directively">
          <TextInput
            value={description}
            onChange={setDescription}
            placeholder="e.g. Enforce strict TypeScript checks across all files."
          />
        </FormField>
        <FormField label="Type">
          <SelectInput
            value={type}
            onChange={(v) => setType(v as SkillType)}
            options={[...SKILL_TYPE_OPTIONS]}
          />
        </FormField>
        <FormField label="Body (Markdown)">
          <Textarea value={body} onChange={setBody} rows={6} mono />
        </FormField>
      </div>
    </Modal>
  );
}
