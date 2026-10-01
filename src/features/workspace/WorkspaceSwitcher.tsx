import { useState } from "react";
import { Check, ChevronDown, Plus, LineChart, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useWorkspaces, useWorkspaceMutations } from "./useWorkspaces";
import type { Workspace } from "@/db/types";

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const workspaceName = useWorkspaceStore((s) => s.workspaceName);
  const { data: workspaces = [] } = useWorkspaces();
  const { createWorkspace, renameWorkspace, deleteWorkspace, switchTo } = useWorkspaceMutations();

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    await createWorkspace.mutateAsync(newName.trim());
    setNewOpen(false);
    setNewName("");
  }

  function openRename(ws: Workspace) {
    setRenameTarget(ws);
    setRenameDraft(ws.name);
  }

  async function handleRename() {
    if (!renameTarget || !renameDraft.trim()) return;
    await renameWorkspace.mutateAsync({ id: renameTarget.id, name: renameDraft.trim() });
    if (renameTarget.id === workspaceId) useWorkspaceStore.getState().setWorkspace(renameTarget.id, renameDraft.trim());
    setRenameTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteWorkspace.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete this stat sheet.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "group flex w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-2 text-sm font-medium text-[var(--color-text)] transition-colors duration-150 hover:border-[#8b5cf6]/45 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15)]",
              collapsed && "justify-center px-0",
            )}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
            >
              <LineChart className="h-3 w-3 text-white" />
            </span>
            {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{workspaceName}</span>}
            {!collapsed && (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform duration-150 group-data-[state=open]:rotate-180" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => ws.id !== workspaceId && switchTo(ws.id, ws.name)}
              className="group/item flex items-center justify-between gap-2"
            >
              <span className="min-w-0 flex-1 truncate">{ws.name}</span>
              <span className="flex shrink-0 items-center gap-0.5">
                {ws.id === workspaceId && <Check className="mr-1 h-3.5 w-3.5 shrink-0" />}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRename(ws);
                  }}
                  className="rounded p-1 text-[var(--color-text-muted)] opacity-0 transition-opacity hover:text-[var(--color-text)] group-hover/item:opacity-100"
                  aria-label={`Rename ${ws.name}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteError(null);
                    setDeleteTarget(ws);
                  }}
                  className="rounded p-1 text-[var(--color-text-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover/item:opacity-100"
                  aria-label={`Delete ${ws.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setNewOpen(true)} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> New Stat Sheet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Stat Sheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Funded Account #2"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              Starts empty — apply a template from the Variables page if you want the default tag schema.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createWorkspace.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Stat Sheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={renameWorkspace.isPending || !renameDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              This permanently deletes every trade, variable, and setting in this stat sheet. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-[var(--color-danger)]">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteWorkspace.isPending}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
