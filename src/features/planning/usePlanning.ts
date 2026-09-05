import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/planning";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Period } from "@/db/types";
import type { PlanningEntryInput } from "@/db/queries/planning";

export function usePlanningEntries(period?: Period) {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  return useQuery({
    queryKey: ["planningEntries", workspaceId, period],
    queryFn: () => api.listPlanningEntries(workspaceId!, period),
    enabled: !!workspaceId,
  });
}

export function usePlanningMutations() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["planningEntries", workspaceId] });

  const createEntry = useMutation({
    mutationFn: (input: PlanningEntryInput) => api.createPlanningEntry(workspaceId!, input),
    onSuccess: invalidate,
  });
  const updateEntry = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PlanningEntryInput }) => api.updatePlanningEntry(id, input),
    onSuccess: invalidate,
  });
  const deleteEntry = useMutation({
    mutationFn: (id: string) => api.deletePlanningEntry(id),
    onSuccess: invalidate,
  });

  return { createEntry, updateEntry, deleteEntry };
}

export function useTasks(period?: Period) {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tasks", workspaceId, period],
    queryFn: () => api.listTasks(workspaceId!, period),
    enabled: !!workspaceId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
  const createTask = useMutation({
    mutationFn: (input: { period: Period; date: string; label: string }) => api.createTask(workspaceId!, input),
    onSuccess: invalidate,
  });
  const toggleTask = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.toggleTask(id, done),
    onSuccess: invalidate,
  });
  const deleteTask = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: invalidate,
  });
  return { ...query, createTask, toggleTask, deleteTask };
}
