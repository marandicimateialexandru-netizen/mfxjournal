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
  /** Only meaningful when the variable allows multiple tags per trade (Liquidity/News) and more than
   *  one value is selected: "any" (default) matches a trade tagged with at least one of the selected
   *  values; "all" matches only a trade tagged with every one of them. For a single-select variable a
   *  trade can only ever have one tagged value, so "all" with >1 selection would never match — the
   *  builder UI only offers the toggle when it's actually meaningful. Omitted/undefined behaves as
   *  "any", so every combination saved before this field existed keeps its exact original behavior. */
  matchMode?: "any" | "all";
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
  /** True only for a real custom variable with `allow_multiple` set (Liquidity/News) — always false
   *  for the four built-in pseudo-dimensions (Months/Days of Week/Time of Day/Market). */
  allowMultiple: boolean;
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
      allowMultiple: false,
      values: MONTH_LABELS.map((label, i) => ({ id: String(i), label, icon: null })),
    },
    {
      id: DAYS_OF_WEEK_DIMENSION,
      label: "Days of Week",
      icon: null,
      allowMultiple: false,
      values: DAY_LABELS.map((label, i) => ({ id: String(i), label, icon: null })),
    },
    {
      id: TIME_OF_DAY_DIMENSION,
      label: "Time of Day",
      icon: null,
      allowMultiple: false,
      values: HOUR_VALUES,
    },
    {
      id: MARKET_DIMENSION,
      label: "Market",
      icon: null,
      allowMultiple: false,
      values: markets.map((m) => ({ id: m.symbol, label: m.symbol, icon: null })),
    },
    ...variables
      .filter((v) => v.type === "text")
      .map((v) => ({
        id: v.id,
        label: v.label,
        icon: v.icon,
        allowMultiple: v.allow_multiple === 1,
        values: v.values.map((val) => ({ id: val.id, label: val.label, icon: val.icon })),
      })),
  ];
}

function bucketKeysForTrade(trade: Trade, variableId: string): string[] {
  if (variableId === MONTHS_DIMENSION) return [String(new Date(trade.entry_time).getMonth())];
  if (variableId === DAYS_OF_WEEK_DIMENSION) return [String(new Date(trade.entry_time).getDay())];
  if (variableId === TIME_OF_DAY_DIMENSION) return [String(new Date(trade.entry_time).getHours())];
  if (variableId === MARKET_DIMENSION) return trade.market ? [trade.market] : [];
  return trade.variableValues?.[variableId]?.valueIds ?? [];
}

export function tradeMatchesFilter(trade: Trade, filter: CombinationFilter): boolean {
  const keys = bucketKeysForTrade(trade, filter.variableId);
  const isInSelection =
    filter.matchMode === "all"
      ? filter.valueIds.length > 0 && filter.valueIds.every((id) => keys.includes(id))
      : filter.valueIds.some((id) => keys.includes(id));
  return filter.include ? isInSelection : !isInSelection;
}

/** Ad-hoc AND-of-variable-value predicate: narrows trades before handing them to the central stats engine. */
export function applyCombinationFilters(trades: Trade[], filters: CombinationFilter[]): Trade[] {
  if (filters.length === 0) return [];
  return trades.filter((t) => filters.every((f) => tradeMatchesFilter(t, f)));
}
