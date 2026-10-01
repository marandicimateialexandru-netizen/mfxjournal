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

  const deleteWorkspace = useMutation({
    mutationFn: async (id: string) => {
      const remaining = await api.listWorkspaces(profileId!);
      if (remaining.length <= 1) {
        throw new Error("Can't delete your only stat sheet — create another one first if you want to replace it.");
      }
      await api.deleteWorkspace(id);
      return remaining.find((w) => w.id !== id)!;
    },
    onSuccess: (fallback, deletedId) => {
      invalidate();
      // Deleting the one you're currently looking at needs to land somewhere real, not a workspace
      // that no longer exists — hand off to whatever else the profile still has.
      const currentId = useWorkspaceStore.getState().workspaceId;
      if (currentId === deletedId) switchTo(fallback.id, fallback.name);
    },
  });

  function switchTo(id: string, name: string) {
    setWorkspace(id, name);
    if (profileId) setPersistedWorkspaceId(profileId, id);
  }

  return { createWorkspace, renameWorkspace, deleteWorkspace, switchTo };
}
