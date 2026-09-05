import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/settings";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Settings } from "@/db/types";

export function useSettings() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  return useQuery({
    queryKey: ["settings", workspaceId],
    queryFn: () => api.getSettings(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useUpdateSettings() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<Settings, "workspace_id">>) => api.updateSettings(workspaceId!, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", workspaceId] }),
  });
}
