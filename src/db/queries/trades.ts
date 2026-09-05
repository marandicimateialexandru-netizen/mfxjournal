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
  variableValues?: Record<string, { valueId?: string; numberValue?: number }>;
  screenshots?: string[]; // file paths, in order
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
  return trades.map((t) => ({
    ...t,
    workspace_id: workspaceId,
    variableValues: Object.fromEntries(
      vvRows
        .filter((v) => v.trade_id === t.id)
        .map((v) => [v.variable_id, { valueId: v.value_id ?? undefined, numberValue: v.number_value ?? undefined }]),
    ),
    screenshots: shots.filter((s) => s.trade_id === t.id),
  }));
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

async function writeVariableValues(
  tradeId: string,
  variableValues?: Record<string, { valueId?: string; numberValue?: number }>,
): Promise<void> {
  if (!variableValues) return;
  for (const [variableId, v] of Object.entries(variableValues)) {
    if (v.valueId == null && v.numberValue == null) continue;
    await execute(
      "INSERT INTO trade_variable_values (trade_id, variable_id, value_id, number_value) VALUES (?, ?, ?, ?)",
      [tradeId, variableId, v.valueId ?? null, v.numberValue ?? null],
    );
  }
}

async function writeScreenshots(tradeId: string, paths?: string[]): Promise<void> {
  if (!paths) return;
  for (let i = 0; i < paths.length; i++) {
    await execute(
      "INSERT INTO trade_screenshots (id, trade_id, file_path, sort_order) VALUES (?, ?, ?, ?)",
      [newId(), tradeId, paths[i], i],
    );
  }
}
