import { select, execute } from "../client";
import { newId, nowIso } from "@/lib/id";
import type { Trade, TradeVariableValue, TradeScreenshot } from "../types";

export interface TradeInput {
  strategy_id?: string | null;
  account_id?: string | null;
  entry_time: string;
  end_time?: string | null;
  outcome: string;
  risk_r?: number | null;
  result_r: number;
  market?: string | null;
  notes?: string | null;
  is_seed?: boolean;
  variableValues?: Record<string, { valueId?: string; valueIds?: string[]; numberValue?: number }>;
  screenshots?: { path: string; label: string | null }[];
}

async function hydrate(workspaceId: string, trades: Trade[]): Promise<Trade[]> {
  if (trades.length === 0) return trades;
  const ids = trades.map((t) => t.id);
  const placeholders = ids.map(() => "?").join(",");
  const vvRows = await select<TradeVariableValue>(
    `SELECT * FROM trade_variable_values WHERE trade_id IN (${placeholders})`,
    ids,
  );
  const shots = await select<TradeScreenshot>(
    `SELECT * FROM trade_screenshots WHERE trade_id IN (${placeholders}) ORDER BY sort_order ASC`,
    ids,
  );
  return trades.map((t) => {
    // Grouped, not Object.fromEntries-collapsed — a multi-tag variable can have more than one row
    // here, and collapsing by variable_id would silently keep only the last one.
    const byVariable = new Map<string, { valueIds: string[]; numberValue?: number }>();
    for (const v of vvRows) {
      if (v.trade_id !== t.id) continue;
      const entry = byVariable.get(v.variable_id) ?? { valueIds: [] };
      if (v.value_id != null) entry.valueIds.push(v.value_id);
      if (v.number_value != null) entry.numberValue = v.number_value;
      byVariable.set(v.variable_id, entry);
    }
    const variableValues: Trade["variableValues"] = {};
    for (const [variableId, entry] of byVariable) {
      variableValues[variableId] = {
        valueId: entry.valueIds[0],
        valueIds: entry.valueIds.length > 0 ? entry.valueIds : undefined,
        numberValue: entry.numberValue,
      };
    }
    return {
      ...t,
      workspace_id: workspaceId,
      variableValues,
      screenshots: shots.filter((s) => s.trade_id === t.id),
    };
  });
}

export async function listTrades(workspaceId: string): Promise<Trade[]> {
  const trades = await select<Trade>(
    "SELECT * FROM trades WHERE workspace_id = ? ORDER BY entry_time ASC",
    [workspaceId],
  );
  return hydrate(workspaceId, trades);
}

export async function getTrade(id: string): Promise<Trade | null> {
  const rows = await select<Trade>("SELECT * FROM trades WHERE id = ?", [id]);
  if (rows.length === 0) return null;
  const [hydrated] = await hydrate(rows[0].workspace_id, rows);
  return hydrated;
}

export async function createTrade(workspaceId: string, input: TradeInput): Promise<Trade> {
  const id = newId();
  const now = nowIso();
  await execute(
    `INSERT INTO trades (id, workspace_id, strategy_id, account_id, entry_time, end_time, outcome, risk_r, result_r, market, notes, is_seed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      input.strategy_id ?? null,
      input.account_id ?? null,
      input.entry_time,
      input.end_time ?? null,
      input.outcome,
      input.risk_r ?? null,
      input.result_r,
      input.market ?? null,
      input.notes ?? null,
      input.is_seed ? 1 : 0,
      now,
      now,
    ],
  );
  await writeVariableValues(id, input.variableValues);
  await writeScreenshots(id, input.screenshots);
  return (await getTrade(id))!;
}

export async function updateTrade(id: string, input: TradeInput): Promise<Trade> {
  const now = nowIso();
  await execute(
    `UPDATE trades SET strategy_id = ?, account_id = ?, entry_time = ?, end_time = ?, outcome = ?, risk_r = ?, result_r = ?, market = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.strategy_id ?? null,
      input.account_id ?? null,
      input.entry_time,
      input.end_time ?? null,
      input.outcome,
      input.risk_r ?? null,
      input.result_r,
      input.market ?? null,
      input.notes ?? null,
      now,
      id,
    ],
  );
  await execute("DELETE FROM trade_variable_values WHERE trade_id = ?", [id]);
  await writeVariableValues(id, input.variableValues);
  if (input.screenshots) {
    await execute("DELETE FROM trade_screenshots WHERE trade_id = ?", [id]);
    await writeScreenshots(id, input.screenshots);
  }
  return (await getTrade(id))!;
}

export async function deleteTrade(id: string): Promise<void> {
  await execute("DELETE FROM trades WHERE id = ?", [id]);
}

export async function deleteTrades(ids: string[]): Promise<void> {
  for (const id of ids) await deleteTrade(id);
}

/** Deletes every trade in a workspace, explicitly cascading to child rows (FK cascade isn't enabled on this connection). */
export async function deleteAllTrades(workspaceId: string): Promise<void> {
  const trades = await select<{ id: string }>("SELECT id FROM trades WHERE workspace_id = ?", [workspaceId]);
  const ids = trades.map((t) => t.id);
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  await execute(`DELETE FROM trade_screenshots WHERE trade_id IN (${placeholders})`, ids);
  await execute(`DELETE FROM trade_variable_values WHERE trade_id IN (${placeholders})`, ids);
  await execute(`DELETE FROM planning_entry_trades WHERE trade_id IN (${placeholders})`, ids);
  await execute("DELETE FROM trades WHERE workspace_id = ?", [workspaceId]);
}

async function writeVariableValues(
  tradeId: string,
  variableValues?: Record<string, { valueId?: string; valueIds?: string[]; numberValue?: number }>,
): Promise<void> {
  if (!variableValues) return;
  for (const [variableId, v] of Object.entries(variableValues)) {
    if (v.valueIds && v.valueIds.length > 0) {
      for (const valueId of v.valueIds) {
        await execute(
          "INSERT INTO trade_variable_values (trade_id, variable_id, value_id, number_value) VALUES (?, ?, ?, ?)",
          [tradeId, variableId, valueId, null],
        );
      }
      continue;
    }
    if (v.valueId == null && v.numberValue == null) continue;
    await execute(
      "INSERT INTO trade_variable_values (trade_id, variable_id, value_id, number_value) VALUES (?, ?, ?, ?)",
      [tradeId, variableId, v.valueId ?? null, v.numberValue ?? null],
    );
  }
}

async function writeScreenshots(tradeId: string, shots?: { path: string; label: string | null }[]): Promise<void> {
  if (!shots) return;
  for (let i = 0; i < shots.length; i++) {
    await execute(
      "INSERT INTO trade_screenshots (id, trade_id, file_path, sort_order, label) VALUES (?, ?, ?, ?, ?)",
      [newId(), tradeId, shots[i].path, i, shots[i].label],
    );
  }
}
