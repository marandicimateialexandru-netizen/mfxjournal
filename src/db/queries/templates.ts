import { select, execute } from "../client";
import { newId, nowIso } from "@/lib/id";
import type { VariableTemplate, TemplateData } from "../types";

/** Templates belong to the trader, not the stat sheet they happened to be saved from — scoped by
 *  `profile_id` so one saved template shows up when applying a template to ANY of that profile's
 *  stat sheets, not just the one it was created on. */
export async function listTemplates(profileId: string): Promise<VariableTemplate[]> {
  return select<VariableTemplate>(
    "SELECT * FROM variable_templates WHERE profile_id = ? ORDER BY created_at DESC",
    [profileId],
  );
}

export async function createTemplate(
  workspaceId: string,
  profileId: string,
  name: string,
  description: string | null,
  data: TemplateData,
): Promise<VariableTemplate> {
  const template: VariableTemplate = {
    id: newId(),
    workspace_id: workspaceId,
    profile_id: profileId,
    name,
    description,
    data: JSON.stringify(data),
    created_at: nowIso(),
  };
  await execute(
    "INSERT INTO variable_templates (id, workspace_id, profile_id, name, description, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [template.id, template.workspace_id, template.profile_id, template.name, template.description, template.data, template.created_at],
  );
  return template;
}

export async function deleteTemplate(id: string): Promise<void> {
  await execute("DELETE FROM variable_templates WHERE id = ?", [id]);
}
