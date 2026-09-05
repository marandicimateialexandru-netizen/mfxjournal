import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as customResultsApi from "@/db/queries/customResults";
import * as marketsApi from "@/db/queries/markets";
import * as accountsApi from "@/db/queries/accounts";
import * as streakApi from "@/db/queries/streakThresholds";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function useCustomResults() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["customResults", workspaceId],
    queryFn: () => customResultsApi.listCustomResults(workspaceId!),
    enabled: !!workspaceId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customResults", workspaceId] });
  const create = useMutation({
    mutationFn: ({ label, mapsTo }: { label: string; mapsTo: "win" | "loss" | "be" }) =>
      customResultsApi.createCustomResult(workspaceId!, label, mapsTo),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => customResultsApi.deleteCustomResult(id),
    onSuccess: invalidate,
  });
  return { ...query, create, remove };
}

export function useMarkets() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["markets", workspaceId],
    queryFn: () => marketsApi.listMarkets(workspaceId!),
    enabled: !!workspaceId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["markets", workspaceId] });
  const create = useMutation({
    mutationFn: (symbol: string) => marketsApi.createMarket(workspaceId!, symbol),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => marketsApi.deleteMarket(id),
    onSuccess: invalidate,
  });
  return { ...query, create, remove };
}

export function useAccounts() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => accountsApi.listAccounts(workspaceId!),
    enabled: !!workspaceId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["accounts", workspaceId] });
  const create = useMutation({
    mutationFn: (name: string) => accountsApi.createAccount(workspaceId!, name),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => accountsApi.deleteAccount(id),
    onSuccess: invalidate,
  });
  return { ...query, create, remove };
}

export function useStreakThresholds() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["streakThresholds", workspaceId],
    queryFn: () => streakApi.ensureDefaultStreakThresholds(workspaceId!),
    enabled: !!workspaceId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["streakThresholds", workspaceId] });
  const add = useMutation({
    mutationFn: ({ threshold, beBreaksStreak }: { threshold: number; beBreaksStreak: boolean }) =>
      streakApi.addStreakThreshold(workspaceId!, threshold, beBreaksStreak),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof streakApi.updateStreakThreshold>[1] }) =>
      streakApi.updateStreakThreshold(id, patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => streakApi.deleteStreakThreshold(id),
    onSuccess: invalidate,
  });
  return { ...query, add, update, remove };
}
