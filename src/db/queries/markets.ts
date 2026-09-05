import { select, execute } from "../client";
import { newId } from "@/lib/id";
import type { Market } from "../types";

export async function listMarkets(workspaceId: string): Promise<Market[]> {
  return select<Market>("SELECT * FROM markets WHERE workspace_id = ? ORDER BY symbol ASC", [
    workspaceId,
  ]);
}

export async function createMarket(workspaceId: string, symbol: string): Promise<Market> {
  const market: Market = { id: newId(), workspace_id: workspaceId, symbol };
  await execute("INSERT INTO markets (id, workspace_id, symbol) VALUES (?, ?, ?)", [
    market.id,
    market.workspace_id,
    market.symbol,
  ]);
  return market;
}

export async function deleteMarket(id: string): Promise<void> {
  await execute("DELETE FROM markets WHERE id = ?", [id]);
}
