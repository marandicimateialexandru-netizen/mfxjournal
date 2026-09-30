import type { Trade, CustomResult } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";
import { computeStats } from "@/features/stats/computeStats";
import { DAY_LABELS } from "@/features/stats/pseudoVariables";

export const QUERY_TRADES_TOOL_NAME = "query_trades";

export const QUERY_TRADES_TOOL_DESCRIPTION =
  "Query this trader's ACTUAL trade history with any combination of filters (a tagged variable value, an hour range, a day of week, a market) and get back the exact trade count, win rate, average R, and total R for that specific slice. Use this whenever a question crosses two or more dimensions that aren't already broken out together in the data you were given (for example: 'which setup works best at 12:00', 'what's my win rate on EURUSD on Fridays', 'how does the London session perform after a loss'). Always call this instead of saying the breakdown isn't available — it always is, this tool computes it live.";

export const QUERY_TRADES_JSON_SCHEMA = {
  type: "object",
  properties: {
    variableFilters: {
      type: "array",
      description: "Zero or more {variableLabel, valueLabel} pairs, matched case-insensitively. A trade must match ALL of them (AND).",
      items: {
        type: "object",
        properties: {
          variableLabel: { type: "string", description: "e.g. 'Setup', 'Session'" },
          valueLabel: { type: "string", description: "e.g. 'Slab', 'London'" },
        },
        required: ["variableLabel", "valueLabel"],
      },
    },
    startHour: { type: "integer", description: "Inclusive local start hour, 0-23. Omit to leave unbounded." },
    endHour: { type: "integer", description: "Exclusive local end hour, 1-24. Omit to leave unbounded." },
    dayOfWeek: { type: "string", description: "One of Sunday, Monday, ... Saturday. Omit to include all days." },
    market: { type: "string", description: "Exact market symbol, e.g. EURUSD. Omit to include all markets." },
  },
};

export interface QueryTradesInput {
  variableFilters?: { variableLabel: string; valueLabel: string }[];
  startHour?: number;
  endHour?: number;
  dayOfWeek?: string;
  market?: string;
}

export interface QueryTradesResult {
  matchedTrades: number;
  winRatePct: number;
  beRatePct: number;
  avgR: number;
  totalR: number;
  expectancyR: number;
  filtersApplied: string[];
}

/** Executes a `query_trades` tool call locally against the same canonical stats engine every page in
 *  the app uses — the model never sees raw trades or does its own arithmetic, it only gets back
 *  numbers this function computed, so a cross-cut answer is exactly as trustworthy as any other stat
 *  in the app. Unknown variable/value labels or a bad day name are silently ignored rather than
 *  erroring, so a slightly-off filter still returns the closest sensible slice instead of a failure. */
export function runQueryTradesTool(
  input: QueryTradesInput,
  trades: Trade[],
  variables: VariableWithValues[],
  customResults: CustomResult[],
): QueryTradesResult {
  let filtered = trades;
  const filtersApplied: string[] = [];

  if (input.market) {
    const market = input.market.toLowerCase();
    filtered = filtered.filter((t) => t.market?.toLowerCase() === market);
    filtersApplied.push(`market=${input.market}`);
  }

  if (input.dayOfWeek) {
    const dayIndex = DAY_LABELS.findIndex((d) => d.toLowerCase() === input.dayOfWeek!.toLowerCase());
    if (dayIndex >= 0) {
      filtered = filtered.filter((t) => new Date(t.entry_time).getDay() === dayIndex);
      filtersApplied.push(`dayOfWeek=${input.dayOfWeek}`);
    }
  }

  if (input.startHour != null || input.endHour != null) {
    const start = input.startHour ?? 0;
    const end = input.endHour ?? 24;
    filtered = filtered.filter((t) => {
      const h = new Date(t.entry_time).getHours();
      return h >= start && h < end;
    });
    filtersApplied.push(`hour=${start}-${end}`);
  }

  for (const vf of input.variableFilters ?? []) {
    const variable = variables.find((v) => v.label.toLowerCase() === vf.variableLabel.toLowerCase());
    if (!variable) continue;
    const value = variable.values.find((v) => v.label.toLowerCase() === vf.valueLabel.toLowerCase());
    if (!value) continue;
    filtered = filtered.filter((t) => t.variableValues?.[variable.id]?.valueId === value.id);
    filtersApplied.push(`${variable.label}=${value.label}`);
  }

  const stats = computeStats(filtered, { customResults });
  return {
    matchedTrades: stats.totalTrades,
    winRatePct: Math.round(stats.winRatePct * 10) / 10,
    beRatePct: Math.round(stats.beRatePct * 10) / 10,
    avgR: Math.round(stats.avgR * 100) / 100,
    totalR: Math.round(stats.totalR * 100) / 100,
    expectancyR: Math.round(stats.expectancyR * 100) / 100,
    filtersApplied,
  };
}
