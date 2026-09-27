import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/workspaces";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useAuthStore } from "@/store/authStore";
import { setPersistedWorkspaceId } from "@/lib/activeWorkspace";

export function useWorkspaces() {
  const profileId = useAuthStore((s) => s.currentProfileId);
  return useQuery({
    queryKey: ["workspaces", profileId],
    queryFn: () => api.listWorkspaces(profileId!),
    enabled: !!profileId,
  });
}

export function useWorkspaceMutations() {
  const queryClient = useQueryClient();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const profileId = useAuthStore((s) => s.currentProfileId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workspaces", profileId] });

  const createWorkspace = useMutation({
    mutationFn: (name: string) => api.createWorkspace(name, profileId!),
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
    if (profileId) setPersistedWorkspaceId(profileId, id);
  }

  return { createWorkspace, renameWorkspace, switchTo };
}
