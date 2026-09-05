import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/strategies";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function useStrategies() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  return useQuery({
    queryKey: ["strategies", workspaceId],
    queryFn: () => api.listStrategies(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useStrategyMutations() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["strategies", workspaceId] });

  const createStrategy = useMutation({
    mutationFn: (input: { name: string; icon?: string; description?: string }) =>
      api.createStrategy(workspaceId!, input),
    onSuccess: invalidate,
  });
  const updateStrategy = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateStrategy>[1] }) =>
      api.updateStrategy(id, patch),
    onSuccess: invalidate,
  });
  const deleteStrategy = useMutation({
    mutationFn: (id: string) => api.deleteStrategy(id),
    onSuccess: invalidate,
  });

  return { createStrategy, updateStrategy, deleteStrategy };
}
