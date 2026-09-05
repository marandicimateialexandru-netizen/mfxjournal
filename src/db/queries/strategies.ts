import { select, execute } from "../client";
import { newId } from "@/lib/id";
import type { Strategy } from "../types";

export async function listStrategies(workspaceId: string): Promise<Strategy[]> {
  return select<Strategy>("SELECT * FROM strategies WHERE workspace_id = ? ORDER BY name ASC", [
    workspaceId,
  ]);
}

export async function createStrategy(
  workspaceId: string,
  input: { name: string; icon?: string; description?: string },
): Promise<Strategy> {
  const strategy: Strategy = {
    id: newId(),
    workspace_id: workspaceId,
    name: input.name,
    icon: input.icon ?? null,
    description: input.description ?? null,
  };
  await execute(
    "INSERT INTO strategies (id, workspace_id, name, icon, description) VALUES (?, ?, ?, ?, ?)",
    [strategy.id, strategy.workspace_id, strategy.name, strategy.icon, strategy.description],
  );
  return strategy;
}

export async function updateStrategy(
  id: string,
  patch: Partial<Pick<Strategy, "name" | "icon" | "description">>,
): Promise<void> {
  const current = await select<Strategy>("SELECT * FROM strategies WHERE id = ?", [id]);
  if (current.length === 0) return;
  const merged = { ...current[0], ...patch };
  await execute("UPDATE strategies SET name = ?, icon = ?, description = ? WHERE id = ?", [
    merged.name,
    merged.icon,
    merged.description,
    id,
  ]);
}

export async function deleteStrategy(id: string): Promise<void> {
  await execute("UPDATE trades SET strategy_id = NULL WHERE strategy_id = ?", [id]);
  await execute("DELETE FROM strategies WHERE id = ?", [id]);
}
