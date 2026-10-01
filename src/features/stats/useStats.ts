import { useMemo } from "react";
import { computeStats } from "./computeStats";
import type { StatsOptions } from "./types";
import { useTrades } from "@/features/trades/useTrades";
import { useVariables } from "@/features/variables/useVariables";
import { useCustomResults } from "@/features/variables/useAuxLists";
import { useSettings } from "@/features/settings/useSettings";
import { resolveDateRange } from "@/lib/dateRange";
import { useUiStore } from "@/store/uiStore";

/** Wires the canonical stats engine up to live app state (trades, variables, filters, settings). */
export function useStats(extra?: Partial<StatsOptions>) {
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: variables = [], isLoading: variablesLoading } = useVariables();
  const { data: customResults = [] } = useCustomResults();
  const { data: settings } = useSettings();
  const dateRange = useUiStore((s) => s.dateRange);
  const strategyId = useUiStore((s) => s.strategyId);
  const beInWinRate = useUiStore((s) => s.beInWinRate);
  const symbolFilter = useUiStore((s) => s.symbolFilter);

  const resolvedRange = useMemo(() => resolveDateRange(dateRange), [dateRange]);

  const stats = useMemo(
    () =>
      computeStats(trades, {
        variables,
        customResults,
        dateRange: resolvedRange ?? undefined,
        strategyId: strategyId ?? undefined,
        beInWinRate,
        symbol: symbolFilter ?? undefined,
        ...extra,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, variables, customResults, resolvedRange, strategyId, beInWinRate, symbolFilter, JSON.stringify(extra)],
  );

  return { stats, trades, variables, customResults, settings, isLoading: tradesLoading || variablesLoading };
}
