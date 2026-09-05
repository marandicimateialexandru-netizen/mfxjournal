import { select, execute } from "../client";
import { newId } from "@/lib/id";
import type { CustomResult } from "../types";

export async function listCustomResults(workspaceId: string): Promise<CustomResult[]> {
  return select<CustomResult>("SELECT * FROM custom_results WHERE workspace_id = ?", [workspaceId]);
}

export async function createCustomResult(
  workspaceId: string,
  label: string,
  mapsTo: "win" | "loss" | "be",
): Promise<CustomResult> {
  const result: CustomResult = { id: newId(), workspace_id: workspaceId, label, maps_to: mapsTo };
  await execute("INSERT INTO custom_results (id, workspace_id, label, maps_to) VALUES (?, ?, ?, ?)", [
    result.id,
    result.workspace_id,
    result.label,
    result.maps_to,
  ]);
  return result;
}

export async function deleteCustomResult(id: string): Promise<void> {
  await execute("DELETE FROM custom_results WHERE id = ?", [id]);
}

/** Maps an outcome (which may be 'win'/'loss'/'be' or a custom_result id) to its underlying calculation category. */
export function resolveOutcomeCategory(
  outcome: string,
  customResults: CustomResult[],
): "win" | "loss" | "be" {
  if (outcome === "win" || outcome === "loss" || outcome === "be") return outcome;
  const custom = customResults.find((c) => c.id === outcome);
  return custom?.maps_to ?? "be";
}
