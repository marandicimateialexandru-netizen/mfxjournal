import { select, execute } from "../client";
import { newId, nowIso } from "@/lib/id";
import type { PlanningEntry, Task, Period } from "../types";

export interface PlanningEntryInput {
  period: Period;
  date_start: string;
  date_end?: string | null;
  title?: string | null;
  mood?: number | null;
  energy?: number | null;
  confidence?: number | null;
  journal_text?: string | null;
  linkedTradeIds?: string[];
}

async function hydrateEntries(entries: PlanningEntry[]): Promise<PlanningEntry[]> {
  if (entries.length === 0) return entries;
  const ids = entries.map((e) => e.id);
  const placeholders = ids.map(() => "?").join(",");
  const links = await select<{ entry_id: string; trade_id: string }>(
    `SELECT * FROM planning_entry_trades WHERE entry_id IN (${placeholders})`,
    ids,
  );
  return entries.map((e) => ({
    ...e,
    linkedTradeIds: links.filter((l) => l.entry_id === e.id).map((l) => l.trade_id),
  }));
}

export async function listPlanningEntries(
  workspaceId: string,
  period?: Period,
): Promise<PlanningEntry[]> {
  const rows = period
    ? await select<PlanningEntry>(
        "SELECT * FROM planning_entries WHERE workspace_id = ? AND period = ? ORDER BY date_start DESC",
        [workspaceId, period],
      )
    : await select<PlanningEntry>(
        "SELECT * FROM planning_entries WHERE workspace_id = ? ORDER BY date_start DESC",
        [workspaceId],
      );
  return hydrateEntries(rows);
}

export async function createPlanningEntry(
  workspaceId: string,
  input: PlanningEntryInput,
): Promise<PlanningEntry> {
  const id = newId();
  const now = nowIso();
  await execute(
    `INSERT INTO planning_entries (id, workspace_id, period, date_start, date_end, title, mood, energy, confidence, journal_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      input.period,
      input.date_start,
      input.date_end ?? null,
      input.title ?? null,
      input.mood ?? null,
      input.energy ?? null,
      input.confidence ?? null,
      input.journal_text ?? null,
      now,
    ],
  );
  await linkTrades(id, input.linkedTradeIds);
  return { id, workspace_id: workspaceId, ...input, date_end: input.date_end ?? null, title: input.title ?? null, mood: input.mood ?? null, energy: input.energy ?? null, confidence: input.confidence ?? null, journal_text: input.journal_text ?? null, created_at: now };
}

export async function updatePlanningEntry(id: string, input: PlanningEntryInput): Promise<void> {
  await execute(
    `UPDATE planning_entries SET period = ?, date_start = ?, date_end = ?, title = ?, mood = ?, energy = ?, confidence = ?, journal_text = ?
     WHERE id = ?`,
    [
      input.period,
      input.date_start,
      input.date_end ?? null,
      input.title ?? null,
      input.mood ?? null,
      input.energy ?? null,
      input.confidence ?? null,
      input.journal_text ?? null,
      id,
    ],
  );
  await execute("DELETE FROM planning_entry_trades WHERE entry_id = ?", [id]);
  await linkTrades(id, input.linkedTradeIds);
}

export async function deletePlanningEntry(id: string): Promise<void> {
  await execute("DELETE FROM planning_entries WHERE id = ?", [id]);
}

async function linkTrades(entryId: string, tradeIds?: string[]): Promise<void> {
  if (!tradeIds) return;
  for (const tradeId of tradeIds) {
    await execute(
      "INSERT OR IGNORE INTO planning_entry_trades (entry_id, trade_id) VALUES (?, ?)",
      [entryId, tradeId],
    );
  }
}

// Tasks

export async function listTasks(workspaceId: string, period?: Period): Promise<Task[]> {
  return period
    ? select<Task>("SELECT * FROM tasks WHERE workspace_id = ? AND period = ? ORDER BY date ASC", [
        workspaceId,
        period,
      ])
    : select<Task>("SELECT * FROM tasks WHERE workspace_id = ? ORDER BY date ASC", [workspaceId]);
}

export async function createTask(
  workspaceId: string,
  input: { period: Period; date: string; label: string },
): Promise<Task> {
  const task: Task = { id: newId(), workspace_id: workspaceId, ...input, done: 0 };
  await execute("INSERT INTO tasks (id, workspace_id, period, date, label, done) VALUES (?, ?, ?, ?, ?, ?)", [
    task.id,
    task.workspace_id,
    task.period,
    task.date,
    task.label,
    task.done,
  ]);
  return task;
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  await execute("UPDATE tasks SET done = ? WHERE id = ?", [done ? 1 : 0, id]);
}

export async function deleteTask(id: string): Promise<void> {
  await execute("DELETE FROM tasks WHERE id = ?", [id]);
}
