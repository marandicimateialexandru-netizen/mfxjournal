import { select, execute } from "../client";
import { newId, nowIso } from "@/lib/id";
import type { VariableTemplate, TemplateData } from "../types";

export async function listTemplates(workspaceId: string): Promise<VariableTemplate[]> {
  return select<VariableTemplate>(
    "SELECT * FROM variable_templates WHERE workspace_id = ? ORDER BY created_at DESC",
    [workspaceId],
  );
}

export async function createTemplate(
  workspaceId: string,
  name: string,
  description: string | null,
  data: TemplateData,
): Promise<VariableTemplate> {
  const template: VariableTemplate = {
    id: newId(),
    workspace_id: workspaceId,
    name,
    description,
    data: JSON.stringify(data),
    created_at: nowIso(),
  };
  await execute(
    "INSERT INTO variable_templates (id, workspace_id, name, description, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [template.id, template.workspace_id, template.name, template.description, template.data, template.created_at],
  );
  return template;
}
