import { select, execute } from "../client";
import { newId } from "@/lib/id";
import type { Account } from "../types";

export async function listAccounts(workspaceId: string): Promise<Account[]> {
  return select<Account>("SELECT * FROM accounts WHERE workspace_id = ? ORDER BY name ASC", [
    workspaceId,
  ]);
}

export async function createAccount(workspaceId: string, name: string): Promise<Account> {
  const account: Account = { id: newId(), workspace_id: workspaceId, name };
  await execute("INSERT INTO accounts (id, workspace_id, name) VALUES (?, ?, ?)", [
    account.id,
    account.workspace_id,
    account.name,
  ]);
  return account;
}

export async function deleteAccount(id: string): Promise<void> {
  await execute("UPDATE trades SET account_id = NULL WHERE account_id = ?", [id]);
  await execute("DELETE FROM accounts WHERE id = ?", [id]);
}
