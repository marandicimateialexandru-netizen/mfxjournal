import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/combinations";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function useCombinations() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["customCombinations", workspaceId],
    queryFn: () => api.listCombinations(workspaceId!),
    enabled: !!workspaceId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customCombinations", workspaceId] });

  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.createCombination>[1]) => api.createCombination(workspaceId!, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateCombination>[1] }) =>
      api.updateCombination(id, patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCombination(id),
    onSuccess: invalidate,
  });

  return { ...query, create, update, remove };
}
