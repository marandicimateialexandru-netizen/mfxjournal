import type { Trade, Market } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";
import { DAY_LABELS, MONTH_LABELS } from "./pseudoVariables";

/** Reserved dimension ids for the built-in (non-Variable) filter dimensions. */
export const MONTHS_DIMENSION = "months";
export const DAYS_OF_WEEK_DIMENSION = "days_of_week";
export const TIME_OF_DAY_DIMENSION = "time_of_day";
export const MARKET_DIMENSION = "market";

export interface CombinationFilter {
  variableId: string;
  include: boolean;
  valueIds: string[];
}

export interface CombinationValueOption {
  id: string;
  label: string;
  icon: string | null;
}

export interface CombinationVariableOption {
  id: string;
  label: string;
  icon: string | null;
  values: CombinationValueOption[];
}

const HOUR_VALUES: CombinationValueOption[] = Array.from({ length: 24 }, (_, h) => ({
  id: String(h),
  label: `${String(h).padStart(2, "0")}:00`,
  icon: null,
}));

/** Builds the "Select variable..." options for the Combination builder: built-ins first, then every custom text variable in its configured order. */
export function buildCombinationVariableOptions(
  variables: VariableWithValues[],
  markets: Market[],
): CombinationVariableOption[] {
  return [
    {
      id: MONTHS_DIMENSION,
      label: "Months",
      icon: null,
      values: MONTH_LABELS.map((label, i) => ({ id: String(i), label, icon: null })),
    },
    {
      id: DAYS_OF_WEEK_DIMENSION,
      label: "Days of Week",
      icon: null,
      values: DAY_LABELS.map((label, i) => ({ id: String(i), label, icon: null })),
    },
    {
      id: TIME_OF_DAY_DIMENSION,
      label: "Time of Day",
      icon: null,
      values: HOUR_VALUES,
    },
    {
      id: MARKET_DIMENSION,
      label: "Market",
      icon: null,
      values: markets.map((m) => ({ id: m.symbol, label: m.symbol, icon: null })),
    },
    ...variables
      .filter((v) => v.type === "text")
      .map((v) => ({
        id: v.id,
        label: v.label,
        icon: v.icon,
        values: v.values.map((val) => ({ id: val.id, label: val.label, icon: val.icon })),
      })),
  ];
}

function bucketKeyForTrade(trade: Trade, variableId: string): string | null {
  if (variableId === MONTHS_DIMENSION) return String(new Date(trade.entry_time).getMonth());
  if (variableId === DAYS_OF_WEEK_DIMENSION) return String(new Date(trade.entry_time).getDay());
  if (variableId === TIME_OF_DAY_DIMENSION) return String(new Date(trade.entry_time).getHours());
  if (variableId === MARKET_DIMENSION) return trade.market ?? null;
  return trade.variableValues?.[variableId]?.valueId ?? null;
}

export function tradeMatchesFilter(trade: Trade, filter: CombinationFilter): boolean {
  const key = bucketKeyForTrade(trade, filter.variableId);
  const isInSelection = key != null && filter.valueIds.includes(key);
  return filter.include ? isInSelection : !isInSelection;
}

/** Ad-hoc AND-of-variable-value predicate: narrows trades before handing them to the central stats engine. */
export function applyCombinationFilters(trades: Trade[], filters: CombinationFilter[]): Trade[] {
  if (filters.length === 0) return [];
  return trades.filter((t) => filters.every((f) => tradeMatchesFilter(t, f)));
}
