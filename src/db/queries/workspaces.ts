import { select, execute } from "../client";
import { newId, nowIso } from "@/lib/id";
import type { Workspace } from "../types";

export async function listWorkspaces(profileId: string): Promise<Workspace[]> {
  return select<Workspace>("SELECT * FROM workspaces WHERE profile_id = ? ORDER BY created_at ASC", [profileId]);
}

export async function createWorkspace(name: string, profileId: string): Promise<Workspace> {
  const ws: Workspace = { id: newId(), name, created_at: nowIso(), profile_id: profileId };
  await execute("INSERT INTO workspaces (id, name, created_at, profile_id) VALUES (?, ?, ?, ?)", [
    ws.id,
    ws.name,
    ws.created_at,
    ws.profile_id,
  ]);
  return ws;
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  await execute("UPDATE workspaces SET name = ? WHERE id = ?", [name, id]);
}

/** Wipes a workspace and everything under it — every table keyed by `workspace_id` directly, plus
 *  what hangs off of trades/variables/entries/sessions within it (screenshots, tagged values,
 *  planning links, chat messages). None of these foreign keys are set up with `ON DELETE CASCADE`
 *  enforcement actually active for this connection (no `PRAGMA foreign_keys = ON` anywhere in this
 *  codebase), so a plain `DELETE FROM workspaces` would silently leave every one of these rows
 *  behind as permanent orphaned garbage — correctness here means deleting children before parents
 *  explicitly, not trusting the schema's `REFERENCES` to do it.
 *
 *  Deliberately NOT included: `variable_templates`. Templates are scoped to the profile that saved
 *  them (see `db/queries/templates.ts`), not the workspace they happened to be saved from — a
 *  template needs to keep working on every other stat sheet that profile owns even after the
 *  original workspace is deleted. */
export async function deleteWorkspace(id: string): Promise<void> {
  await execute("DELETE FROM ai_chat_messages WHERE session_id IN (SELECT id FROM ai_chat_sessions WHERE workspace_id = ?)", [id]);
  await execute("DELETE FROM ai_chat_sessions WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM trade_variable_values WHERE trade_id IN (SELECT id FROM trades WHERE workspace_id = ?)", [id]);
  await execute("DELETE FROM trade_screenshots WHERE trade_id IN (SELECT id FROM trades WHERE workspace_id = ?)", [id]);
  await execute("DELETE FROM planning_entry_trades WHERE entry_id IN (SELECT id FROM planning_entries WHERE workspace_id = ?)", [id]);
  await execute("DELETE FROM planning_entries WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM trades WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM variable_values WHERE variable_id IN (SELECT id FROM variables WHERE workspace_id = ?)", [id]);
  await execute("DELETE FROM variables WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM strategy_tester_rules WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM custom_combinations WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM dashboard_layouts WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM prop_firm_rows WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM streak_thresholds WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM tasks WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM custom_results WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM markets WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM accounts WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM strategies WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM onboarding_state WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM settings WHERE workspace_id = ?", [id]);
  await execute("DELETE FROM workspaces WHERE id = ?", [id]);
}

/** Ensures at least one workspace exists for this profile, returning the first one (created if
 *  necessary). */
export async function ensureDefaultWorkspace(profileId: string): Promise<Workspace> {
  const existing = await listWorkspaces(profileId);
  if (existing.length > 0) return existing[0];
  return createWorkspace("My Stats", profileId);
}

/** Hands every pre-profile-system workspace (rows with no `profile_id`, from before this feature
 *  existed) to whichever profile is created first — so upgrading an existing install never orphans
 *  or loses real trade data; the first person to set up a profile on this machine simply inherits
 *  everything that was already here. */
export async function claimOrphanWorkspaces(profileId: string): Promise<void> {
  await execute("UPDATE workspaces SET profile_id = ? WHERE profile_id IS NULL", [profileId]);
}
