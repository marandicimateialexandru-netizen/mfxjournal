import { select, execute } from "../client";
import { newId, nowIso } from "@/lib/id";
import type { Workspace } from "../types";

export async function listWorkspaces(): Promise<Workspace[]> {
  return select<Workspace>("SELECT * FROM workspaces ORDER BY created_at ASC");
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const ws: Workspace = { id: newId(), name, created_at: nowIso() };
  await execute("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)", [
    ws.id,
    ws.name,
    ws.created_at,
  ]);
  return ws;
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  await execute("UPDATE workspaces SET name = ? WHERE id = ?", [name, id]);
}

/** Ensures at least one workspace exists, returning the first one (created if necessary). */
export async function ensureDefaultWorkspace(): Promise<Workspace> {
  const existing = await listWorkspaces();
  if (existing.length > 0) return existing[0];
  return createWorkspace("My Stats");
}
