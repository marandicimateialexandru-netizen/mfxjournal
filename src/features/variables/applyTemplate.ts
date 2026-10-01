import * as variablesApi from "@/db/queries/variables";
import type { TemplateData, TemplateVariable } from "@/db/types";

/** Maps each current variable id to the template variable key it should become, or null to remove it. */
export type TemplateMapping = Record<string, string | null>;

/**
 * Applies a template to the workspace's variables. Variables the caller maps to a template
 * variable keep their id (and therefore all existing trade tagging) but get relabeled/re-iconed
 * and gain any template values they're missing. Unmapped current variables are deleted; template
 * variables nobody mapped to become brand-new variables.
 */
export async function applyTemplate(
  workspaceId: string,
  template: TemplateData,
  mapping: TemplateMapping,
): Promise<void> {
  const current = await variablesApi.listVariables(workspaceId);

  for (const [currentVariableId, templateKey] of Object.entries(mapping)) {
    if (templateKey == null) {
      await variablesApi.deleteVariable(currentVariableId);
    }
  }

  for (const templateVar of template.variables) {
    const matchedEntry = Object.entries(mapping).find(([, key]) => key === templateVar.key);
    const currentVariable = matchedEntry ? current.find((v) => v.id === matchedEntry[0]) : undefined;

    if (currentVariable) {
      await variablesApi.updateVariable(currentVariable.id, {
        label: templateVar.label,
        icon: templateVar.icon,
        allow_multiple: templateVar.allowMultiple ? 1 : 0,
      });
      if (templateVar.type === "text") {
        const existingByLabel = new Map(currentVariable.values.map((v) => [v.label.toLowerCase(), v]));
        for (const templateValue of templateVar.values) {
          const existing = existingByLabel.get(templateValue.label.toLowerCase());
          if (existing) {
            await variablesApi.updateVariableValue(existing.id, { icon: templateValue.icon });
          } else {
            await variablesApi.addVariableValue(currentVariable.id, templateValue.label, {
              icon: templateValue.icon ?? undefined,
            });
          }
        }
      }
    } else {
      await createFreshVariable(workspaceId, templateVar);
    }
  }
}

async function createFreshVariable(workspaceId: string, templateVar: TemplateVariable): Promise<void> {
  const created = await variablesApi.createVariable(workspaceId, {
    key: templateVar.key,
    label: templateVar.label,
    type: templateVar.type,
    icon: templateVar.icon,
    allowMultiple: templateVar.allowMultiple,
  });
  if (templateVar.type === "text") {
    for (const value of templateVar.values) {
      await variablesApi.addVariableValue(created.id, value.label, { icon: value.icon ?? undefined });
    }
  }
}

/** Builds the portable TemplateData snapshot of the workspace's current variables, for "Save as Template". */
export function buildTemplateDataFromVariables(
  variables: variablesApi.VariableWithValues[],
): TemplateData {
  return {
    variables: variables.map((v) => ({
      key: v.key,
      label: v.label,
      type: v.type,
      icon: v.icon,
      values: v.values.map((val) => ({ label: val.label, icon: val.icon })),
      allowMultiple: v.allow_multiple === 1,
    })),
  };
}
