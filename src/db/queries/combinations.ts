import { select, execute } from "../client";
import { newId } from "@/lib/id";
import type { CustomCombination } from "../types";

export async function listCombinations(workspaceId: string): Promise<CustomCombination[]> {
  return select<CustomCombination>(
    "SELECT * FROM custom_combinations WHERE workspace_id = ? ORDER BY created_at ASC",
    [workspaceId],
  );
}

export async function createCombination(
  workspaceId: string,
  input: { name: string; filters: string; displaySettings: string },
): Promise<CustomCombination> {
  const row: CustomCombination = {
    id: newId(),
    workspace_id: workspaceId,
    name: input.name,
    filters: input.filters,
    display_settings: input.displaySettings,
    created_at: new Date().toISOString(),
  };
  await execute(
    "INSERT INTO custom_combinations (id, workspace_id, name, filters, display_settings, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [row.id, row.workspace_id, row.name, row.filters, row.display_settings, row.created_at],
  );
  return row;
}

export async function updateCombination(
  id: string,
  patch: Partial<Pick<CustomCombination, "name" | "filters" | "display_settings">>,
): Promise<void> {
  const current = await select<CustomCombination>("SELECT * FROM custom_combinations WHERE id = ?", [id]);
  if (current.length === 0) return;
  const merged = { ...current[0], ...patch };
  await execute(
    "UPDATE custom_combinations SET name = ?, filters = ?, display_settings = ? WHERE id = ?",
    [merged.name, merged.filters, merged.display_settings, id],
  );
}

export async function deleteCombination(id: string): Promise<void> {
  await execute("DELETE FROM custom_combinations WHERE id = ?", [id]);
}
