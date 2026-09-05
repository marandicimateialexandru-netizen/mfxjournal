import type { Trade, CustomResult } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

export type OutcomeCategory = "win" | "loss" | "be";

export interface VariableFilter {
  variableId: string;
  valueIds: string[];
}

export interface StatsOptions {
  strategyId?: string;
  accountId?: string;
  variableFilters?: VariableFilter[];
  dateRange?: { start: Date; end: Date };
  /** Configured Variables to break stats down by (drives `byVariable`). */
  variables?: VariableWithValues[];
  /** Needed to resolve non-default outcome strings to win/loss/be. */
  customResults?: CustomResult[];
  /** When true, break-even trades count in the win-rate denominator (as non-wins). Default false (excludes BE, per canonical formula). */
  beInWinRate?: boolean;
  /** When true, a BE trade resets win/loss streaks; when false, BE trades are skipped over. Default true. */
  beBreaksStreak?: boolean;
}

export interface VariableBucketStats {
  valueId: string;
  label: string;
  icon: string | null;
  color: string | null;
  tradeCount: number;
  wins: number;
  losses: number;
  bes: number;
  winRatePct: number;
  beRatePct: number;
  avgR: number;
  totalR: number;
}

export interface EquityPoint {
  tradeIndex: number;
  date: string;
  tradeR: number;
  cumulativeR: number;
}

export interface StreakState {
  type: OutcomeCategory | "none";
  count: number;
}

export interface StatsResult {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRatePct: number;
  beRatePct: number;
  expectancyR: number;
  totalR: number;
  profitFactor: number;
  avgR: number;
  maxDrawdownR: number;
  maxDrawdownTradeCount: number;
  recoveryFactor: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: StreakState;
  largestWin: number;
  largestLoss: number;
  avgWinR: number;
  avgLossR: number;
  equityCurve: EquityPoint[];
  filteredTrades: Trade[];
  byVariable: Record<string, VariableBucketStats[]>;
}
