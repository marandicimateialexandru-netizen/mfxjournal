import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/db/queries/trades";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { TradeInput } from "@/db/queries/trades";

export function useTrades() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  return useQuery({
    queryKey: ["trades", workspaceId],
    queryFn: () => api.listTrades(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useTrade(id: string | null) {
  return useQuery({
    queryKey: ["trade", id],
    queryFn: () => api.getTrade(id!),
    enabled: !!id,
  });
}

export function useTradeMutations() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["trades", workspaceId] });

  const createTrade = useMutation({
    mutationFn: (input: TradeInput) => api.createTrade(workspaceId!, input),
    onSuccess: invalidate,
  });

  const updateTrade = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TradeInput }) => api.updateTrade(id, input),
    onSuccess: invalidate,
  });

  const deleteTrade = useMutation({
    mutationFn: (id: string) => api.deleteTrade(id),
    onSuccess: invalidate,
  });

  const deleteTrades = useMutation({
    mutationFn: (ids: string[]) => api.deleteTrades(ids),
    onSuccess: invalidate,
  });

  return { createTrade, updateTrade, deleteTrade, deleteTrades };
}
