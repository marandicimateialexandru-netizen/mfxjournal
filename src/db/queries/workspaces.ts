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
