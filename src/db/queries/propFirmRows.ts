import { select, execute } from "../client";
import { newId } from "@/lib/id";

export interface PropFirmRow {
  id: string;
  workspace_id: string;
  account_name: string;
  capital: number;
  profit_split_pct: number;
  monthly_pct_override: number | null;
  payout_frequency: string;
  sort_order: number;
}

export async function listPropFirmRows(workspaceId: string): Promise<PropFirmRow[]> {
  return select<PropFirmRow>("SELECT * FROM prop_firm_rows WHERE workspace_id = ? ORDER BY sort_order ASC", [
    workspaceId,
  ]);
}

export async function createPropFirmRow(workspaceId: string): Promise<PropFirmRow> {
  const existing = await select<{ n: number }>(
    "SELECT COUNT(*) as n FROM prop_firm_rows WHERE workspace_id = ?",
    [workspaceId],
  );
  const row: PropFirmRow = {
    id: newId(),
    workspace_id: workspaceId,
    account_name: "New Account",
    capital: 50000,
    profit_split_pct: 80,
    monthly_pct_override: null,
    payout_frequency: "monthly",
    sort_order: existing[0]?.n ?? 0,
  };
  await execute(
    `INSERT INTO prop_firm_rows (id, workspace_id, account_name, capital, profit_split_pct, monthly_pct_override, payout_frequency, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.workspace_id, row.account_name, row.capital, row.profit_split_pct, row.monthly_pct_override, row.payout_frequency, row.sort_order],
  );
  return row;
}

export async function updatePropFirmRow(id: string, patch: Partial<Omit<PropFirmRow, "id" | "workspace_id">>): Promise<void> {
  const current = await select<PropFirmRow>("SELECT * FROM prop_firm_rows WHERE id = ?", [id]);
  if (current.length === 0) return;
  const merged = { ...current[0], ...patch };
  await execute(
    `UPDATE prop_firm_rows SET account_name = ?, capital = ?, profit_split_pct = ?, monthly_pct_override = ?, payout_frequency = ?, sort_order = ?
     WHERE id = ?`,
    [merged.account_name, merged.capital, merged.profit_split_pct, merged.monthly_pct_override, merged.payout_frequency, merged.sort_order, id],
  );
}

export async function deletePropFirmRow(id: string): Promise<void> {
  await execute("DELETE FROM prop_firm_rows WHERE id = ?", [id]);
}
