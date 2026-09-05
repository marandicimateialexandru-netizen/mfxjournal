import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/workspaces";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { setPersistedWorkspaceId } from "@/lib/activeWorkspace";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.listWorkspaces(),
  });
}

export function useWorkspaceMutations() {
  const queryClient = useQueryClient();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workspaces"] });

  const createWorkspace = useMutation({
    mutationFn: (name: string) => api.createWorkspace(name),
    onSuccess: (ws) => {
      invalidate();
      switchTo(ws.id, ws.name);
    },
  });

  const renameWorkspace = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameWorkspace(id, name),
    onSuccess: invalidate,
  });

  function switchTo(id: string, name: string) {
    setWorkspace(id, name);
    setPersistedWorkspaceId(id);
  }

  return { createWorkspace, renameWorkspace, switchTo };
}
