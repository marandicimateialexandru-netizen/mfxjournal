import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/variables";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { VariableType } from "@/db/types";

export function useVariables() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  return useQuery({
    queryKey: ["variables", workspaceId],
    queryFn: () => api.listVariables(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useVariableMutations() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["variables", workspaceId] });

  const createVariable = useMutation({
    mutationFn: (input: { key: string; label: string; type: VariableType; icon?: string | null; firstValue?: string }) =>
      api.createVariable(workspaceId!, input),
    onSuccess: invalidate,
  });

  const updateVariable = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateVariable>[1] }) =>
      api.updateVariable(id, patch),
    onSuccess: invalidate,
  });

  const deleteVariable = useMutation({
    mutationFn: (id: string) => api.deleteVariable(id),
    onSuccess: invalidate,
  });

  const reorderVariables = useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderVariables(orderedIds),
    onSuccess: invalidate,
  });

  const reorderVariableValues = useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderVariableValues(orderedIds),
    onSuccess: invalidate,
  });

  const addValue = useMutation({
    mutationFn: ({ variableId, label, opts }: { variableId: string; label: string; opts?: { icon?: string; color?: string } }) =>
      api.addVariableValue(variableId, label, opts),
    onSuccess: invalidate,
  });

  const updateValue = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateVariableValue>[1] }) =>
      api.updateVariableValue(id, patch),
    onSuccess: invalidate,
  });

  const deleteValue = useMutation({
    mutationFn: (id: string) => api.deleteVariableValue(id),
    onSuccess: invalidate,
  });

  const clearAll = useMutation({
    mutationFn: () => api.clearAllVariables(workspaceId!),
    onSuccess: invalidate,
  });

  return {
    createVariable,
    updateVariable,
    deleteVariable,
    reorderVariables,
    reorderVariableValues,
    addValue,
    updateValue,
    deleteValue,
    clearAll,
  };
}
