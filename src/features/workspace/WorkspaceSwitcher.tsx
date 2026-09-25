import { useState } from "react";
import { Check, ChevronDown, Plus, LineChart } from "lucide-react";
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
