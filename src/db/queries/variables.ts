import { select, execute } from "../client";
import { newId } from "@/lib/id";
import type { Variable, VariableValue, VariableType } from "../types";

export interface VariableWithValues extends Variable {
  values: VariableValue[];
}

export async function listVariables(workspaceId: string): Promise<VariableWithValues[]> {
  const variables = await select<Variable>(
    "SELECT * FROM variables WHERE workspace_id = ? ORDER BY sort_order ASC",
    [workspaceId],
  );
  const values = await select<VariableValue>(
    `SELECT vv.* FROM variable_values vv
     JOIN variables v ON v.id = vv.variable_id
     WHERE v.workspace_id = ? ORDER BY vv.sort_order ASC`,
    [workspaceId],
  );
  return variables.map((v) => ({
    ...v,
    values: values.filter((val) => val.variable_id === v.id),
  }));
}

export async function createVariable(
  workspaceId: string,
  input: { key: string; label: string; type: VariableType; icon?: string | null; firstValue?: string },
): Promise<VariableWithValues> {
  const existing = await select<{ n: number }>(
    "SELECT COUNT(*) as n FROM variables WHERE workspace_id = ?",
    [workspaceId],
  );
  const sortOrder = existing[0]?.n ?? 0;
  const variable: Variable = {
    id: newId(),
    workspace_id: workspaceId,
    key: input.key,
    label: input.label,
    type: input.type,
    icon: input.icon ?? null,
    sort_order: sortOrder,
  };
  await execute(
    "INSERT INTO variables (id, workspace_id, key, label, type, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [variable.id, variable.workspace_id, variable.key, variable.label, variable.type, variable.icon, variable.sort_order],
  );
  const values: VariableValue[] = [];
  if (input.type === "text" && input.firstValue) {
    const value = await addVariableValue(variable.id, input.firstValue);
    values.push(value);
  }
  return { ...variable, values };
}

export async function updateVariable(
  id: string,
  patch: Partial<Pick<Variable, "label" | "icon" | "sort_order">>,
): Promise<void> {
  const current = await select<Variable>("SELECT * FROM variables WHERE id = ?", [id]);
  if (current.length === 0) return;
  const merged = { ...current[0], ...patch };
  await execute("UPDATE variables SET label = ?, icon = ?, sort_order = ? WHERE id = ?", [
    merged.label,
    merged.icon,
    merged.sort_order,
    id,
  ]);
}

export async function reorderVariables(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) => execute("UPDATE variables SET sort_order = ? WHERE id = ?", [index, id])),
  );
}

export async function deleteVariable(id: string): Promise<void> {
  await execute("DELETE FROM variable_values WHERE variable_id = ?", [id]);
  await execute("DELETE FROM trade_variable_values WHERE variable_id = ?", [id]);
  await execute("DELETE FROM variables WHERE id = ?", [id]);
}

export async function addVariableValue(
  variableId: string,
  label: string,
  opts?: { icon?: string; color?: string },
): Promise<VariableValue> {
  const existing = await select<{ n: number }>(
    "SELECT COUNT(*) as n FROM variable_values WHERE variable_id = ?",
    [variableId],
  );
  const value: VariableValue = {
    id: newId(),
    variable_id: variableId,
    label,
    icon: opts?.icon ?? null,
    color: opts?.color ?? null,
    sort_order: existing[0]?.n ?? 0,
  };
  await execute(
    "INSERT INTO variable_values (id, variable_id, label, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    [value.id, value.variable_id, value.label, value.icon, value.color, value.sort_order],
  );
  return value;
}

export async function updateVariableValue(
  id: string,
  patch: Partial<Pick<VariableValue, "label" | "icon" | "color" | "sort_order">>,
): Promise<void> {
  const current = await select<VariableValue>("SELECT * FROM variable_values WHERE id = ?", [id]);
  if (current.length === 0) return;
  const merged = { ...current[0], ...patch };
  await execute(
    "UPDATE variable_values SET label = ?, icon = ?, color = ?, sort_order = ? WHERE id = ?",
    [merged.label, merged.icon, merged.color, merged.sort_order, id],
  );
}

export async function deleteVariableValue(id: string): Promise<void> {
  await execute("DELETE FROM trade_variable_values WHERE value_id = ?", [id]);
  await execute("DELETE FROM variable_values WHERE id = ?", [id]);
}

export async function clearAllVariables(workspaceId: string): Promise<void> {
  const vars = await select<Variable>("SELECT id FROM variables WHERE workspace_id = ?", [workspaceId]);
  for (const v of vars) {
    await deleteVariable(v.id);
  }
}
