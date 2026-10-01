import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPct, formatR } from "@/lib/format";
import { useMarkets } from "@/features/variables/useAuxLists";
import { buildCombinationVariableOptions, applyCombinationFilters } from "@/features/stats/combinationFilters";
import { computeStats } from "@/features/stats/computeStats";
import { FilterRow, toDraftFilters, type DraftFilter } from "@/features/dashboard/CombinationBuilder";
import type { Trade, CustomResult } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

/** An ad-hoc, throwaway version of the Custom Combinations builder — build any set of tagged values
 *  on the spot ("what's my win rate on trades with Local Liquidity + Minor Sweep + a Trump Speech"),
 *  see the real computed answer immediately, with nothing saved. Reuses the exact same `FilterRow`
 *  UI and matching engine as a saved combination, just without the name/save step. */
export function TradeVariableCalculator({
  baseTrades,
  variables,
  customResults,
}: {
  baseTrades: Trade[];
  variables: VariableWithValues[];
  customResults: CustomResult[];
}) {
  const { data: markets = [] } = useMarkets();
  const [filters, setFilters] = useState<DraftFilter[]>(() => toDraftFilters([]));

  const variableOptions = useMemo(() => buildCombinationVariableOptions(variables, markets), [variables, markets]);

  function updateFilter(key: string, patch: Partial<DraftFilter>) {
    setFilters((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function removeFilter(key: string) {
    setFilters((prev) => (prev.length > 1 ? prev.filter((f) => f.key !== key) : prev));
  }

  function addFilter() {
    setFilters((prev) => [...prev, { key: `${Date.now()}-${prev.length}`, variableId: null, include: true, valueIds: [] }]);
  }

  const validFilters = filters
    .filter((f) => f.variableId && f.valueIds.length > 0)
    .map((f) => ({ variableId: f.variableId!, include: f.include, valueIds: f.valueIds, matchMode: f.matchMode }));

  const result = useMemo(() => {
    if (validFilters.length === 0) return null;
    const matching = applyCombinationFilters(baseTrades, validFilters);
    return computeStats(matching, { customResults });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseTrades, customResults, JSON.stringify(validFilters)]);

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {filters.map((f) => (
          <FilterRow key={f.key} filter={f} variableOptions={variableOptions} onChange={(patch) => updateFilter(f.key, patch)} onRemove={() => removeFilter(f.key)} />
        ))}
      </div>

      <Button variant="secondary" size="sm" onClick={addFilter}>
        <Plus className="h-3.5 w-3.5" /> Add Filter
      </Button>

      {result ? (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-4">
          <CalcStat label="Trades" value={String(result.totalTrades)} />
          <CalcStat label="Win Rate" value={formatPct(result.winRatePct)} tone="success" />
          <CalcStat label="BE Rate" value={formatPct(result.beRatePct)} tone="warning" />
          <CalcStat label="Total R" value={formatR(result.totalR, "r", undefined, undefined, { showSign: true })} tone={result.totalR >= 0 ? "success" : "danger"} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-text-muted)]">
          Pick at least one variable and value above to see the win rate for that combination.
        </p>
      )}
    </div>
  );
}

function CalcStat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const toneClass =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "warning"
        ? "text-[var(--color-warning)]"
        : tone === "danger"
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-text)]";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
