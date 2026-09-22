import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useWorkspaces, useWorkspaceMutations } from "./useWorkspaces";

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const workspaceName = useWorkspaceStore((s) => s.workspaceName);
  const { data: workspaces = [] } = useWorkspaces();
  const { createWorkspace, switchTo } = useWorkspaceMutations();

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    await createWorkspace.mutateAsync(newName.trim());
    setNewOpen(false);
    setNewName("");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-2 text-sm font-medium text-[var(--color-text)] transition-colors duration-100 hover:border-[var(--color-primary)]/40",
              collapsed && "justify-center px-0",
            )}
          >
            {!collapsed && <span className="truncate">{workspaceName}</span>}
            {!collapsed && <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />}
            {collapsed && <span className="text-xs">{workspaceName.slice(0, 1)}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => ws.id !== workspaceId && switchTo(ws.id, ws.name)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{ws.name}</span>
              {ws.id === workspaceId && <Check className="h-3.5 w-3.5 shrink-0" />}
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
    </>
  );
}
