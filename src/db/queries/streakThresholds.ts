import { select, execute } from "../client";
import { newId } from "@/lib/id";
import type { StreakThreshold } from "../types";

export async function listStreakThresholds(workspaceId: string): Promise<StreakThreshold[]> {
  return select<StreakThreshold>(
    "SELECT * FROM streak_thresholds WHERE workspace_id = ? ORDER BY threshold ASC",
    [workspaceId],
  );
}

export async function addStreakThreshold(
  workspaceId: string,
  threshold: number,
  beBreaksStreak = true,
): Promise<StreakThreshold> {
  const row: StreakThreshold = {
    id: newId(),
    workspace_id: workspaceId,
    threshold,
    be_breaks_streak: beBreaksStreak ? 1 : 0,
  };
  await execute(
    "INSERT INTO streak_thresholds (id, workspace_id, threshold, be_breaks_streak) VALUES (?, ?, ?, ?)",
    [row.id, row.workspace_id, row.threshold, row.be_breaks_streak],
  );
  return row;
}

export async function updateStreakThreshold(
  id: string,
  patch: Partial<Pick<StreakThreshold, "threshold" | "be_breaks_streak">>,
): Promise<void> {
  const current = await select<StreakThreshold>("SELECT * FROM streak_thresholds WHERE id = ?", [id]);
  if (current.length === 0) return;
  const merged = { ...current[0], ...patch };
  await execute("UPDATE streak_thresholds SET threshold = ?, be_breaks_streak = ? WHERE id = ?", [
    merged.threshold,
    merged.be_breaks_streak,
    id,
  ]);
}

export async function deleteStreakThreshold(id: string): Promise<void> {
  await execute("DELETE FROM streak_thresholds WHERE id = ?", [id]);
}

export async function ensureDefaultStreakThresholds(workspaceId: string): Promise<StreakThreshold[]> {
  const existing = await listStreakThresholds(workspaceId);
  if (existing.length > 0) return existing;
  const defaults = [3, 5, 7, 9];
  const created: StreakThreshold[] = [];
  for (const t of defaults) {
    created.push(await addStreakThreshold(workspaceId, t, true));
  }
  return created;
}
