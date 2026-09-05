import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/propFirmRows";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function usePropFirmRows() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["propFirmRows", workspaceId],
    queryFn: () => api.listPropFirmRows(workspaceId!),
    enabled: !!workspaceId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["propFirmRows", workspaceId] });
  const create = useMutation({ mutationFn: () => api.createPropFirmRow(workspaceId!), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updatePropFirmRow>[1] }) =>
      api.updatePropFirmRow(id, patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.deletePropFirmRow(id), onSuccess: invalidate });
  return { ...query, create, update, remove };
}
