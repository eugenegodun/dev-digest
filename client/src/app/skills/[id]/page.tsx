import { SkillEditorPage } from "./_components/SkillEditorPage";

/* Route: /skills/:id (Skill editor). Thin route entry. */
export default function SkillPage({ params }: { params: { id: string } }) {
  return <SkillEditorPage id={params.id} />;
}
