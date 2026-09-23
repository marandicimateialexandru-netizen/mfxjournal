import type { Trade } from "@/db/types";
import type { StatsOptions, StatsResult, VariableBucketStats, OutcomeCategory, EquityPoint, StreakState } from "./types";

export function resolveOutcomeCategory(
  outcome: string,
  customResults: StatsOptions["customResults"],
): OutcomeCategory {
  if (outcome === "win" || outcome === "loss" || outcome === "be") return outcome;
  const custom = customResults?.find((c) => c.id === outcome);
  return custom?.maps_to ?? "be";
}

function filterTrades(trades: Trade[], options: StatsOptions): Trade[] {
  let result = trades;

  if (options.strategyId) {
    result = result.filter((t) => t.strategy_id === options.strategyId);
  }
  if (options.accountId) {
    result = result.filter((t) => t.account_id === options.accountId);
  }
  if (options.dateRange) {
    const { start, end } = options.dateRange;
    result = result.filter((t) => {
      const time = new Date(t.entry_time).getTime();
      return time >= start.getTime() && time <= end.getTime();
    });
  }
  if (options.variableFilters && options.variableFilters.length > 0) {
    result = result.filter((t) =>
      options.variableFilters!.every((filter) => {
        const tagged = t.variableValues?.[filter.variableId]?.valueId;
        return tagged != null && filter.valueIds.includes(tagged);
      }),
    );
  }

  return [...result].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime(),
  );
}

function computeEquityCurve(trades: Trade[]): EquityPoint[] {
  let cumulative = 0;
  return trades.map((t, i) => {
    cumulative += t.result_r;
    return { tradeIndex: i, date: t.entry_time, tradeR: t.result_r, cumulativeR: cumulative };
  });
}

function computeMaxDrawdown(curve: EquityPoint[]): { maxDrawdownR: number; tradeCount: number } {
  let peak = 0;
  let peakIndex = 0;
  let maxDrawdown = 0;
  let maxDrawdownTradeCount = 0;

  for (let i = 0; i < curve.length; i++) {
    const point = curve[i].cumulativeR;
    if (point > peak) {
      peak = point;
      peakIndex = i;
    }
    const drawdown = peak - point;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownTradeCount = i - peakIndex;
    }
  }

  return { maxDrawdownR: maxDrawdown, tradeCount: maxDrawdownTradeCount };
}

export function computeStreaks(
  categories: OutcomeCategory[],
  beBreaksStreak: boolean,
): { maxWinStreak: number; maxLossStreak: number; currentStreak: StreakState } {
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentType: OutcomeCategory | "none" = "none";
  let currentCount = 0;

  for (const category of categories) {
    if (category === "be") {
      if (beBreaksStreak) {
        currentType = "none";
        currentCount = 0;
      }
      // else: skip over BE, streak continues untouched
      continue;
    }

    if (category === currentType) {
      currentCount += 1;
    } else {
      currentType = category;
      currentCount = 1;
    }

    if (currentType === "win") maxWinStreak = Math.max(maxWinStreak, currentCount);
    if (currentType === "loss") maxLossStreak = Math.max(maxLossStreak, currentCount);
  }

  return {
    maxWinStreak,
    maxLossStreak,
    currentStreak: { type: currentType, count: currentCount },
  };
}

function computeVariableBucket(
  trades: Trade[],
  variableId: string,
  valueId: string,
  label: string,
  icon: string | null,
  color: string | null,
  customResults: StatsOptions["customResults"],
): VariableBucketStats {
  const bucketTrades = trades.filter((t) => t.variableValues?.[variableId]?.valueId === valueId);
  const categories = bucketTrades.map((t) => resolveOutcomeCategory(t.outcome, customResults));
  const wins = categories.filter((c) => c === "win").length;
  const losses = categories.filter((c) => c === "loss").length;
  const bes = categories.filter((c) => c === "be").length;
  const totalR = bucketTrades.reduce((sum, t) => sum + t.result_r, 0);

  return {
    valueId,
    label,
    icon,
    color,
    tradeCount: bucketTrades.length,
    wins,
    losses,
    bes,
    winRatePct: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
    beRatePct: bucketTrades.length > 0 ? (bes / bucketTrades.length) * 100 : 0,
    avgR: bucketTrades.length > 0 ? totalR / bucketTrades.length : 0,
    totalR,
  };
}

export function computeStats(trades: Trade[], options: StatsOptions = {}): StatsResult {
  const filtered = filterTrades(trades, options);
  const beInWinRate = options.beInWinRate ?? false;
  const beBreaksStreak = options.beBreaksStreak ?? true;

  const categories = filtered.map((t) => resolveOutcomeCategory(t.outcome, options.customResults));
  const wins = categories.filter((c) => c === "win").length;
  const losses = categories.filter((c) => c === "loss").length;
  const breakEvens = categories.filter((c) => c === "be").length;
  const totalTrades = filtered.length;

  const winRateDenominator = beInWinRate ? wins + losses + breakEvens : wins + losses;
  const winRatePct = winRateDenominator > 0 ? (wins / winRateDenominator) * 100 : 0;
  const beRatePct = totalTrades > 0 ? (breakEvens / totalTrades) * 100 : 0;

  const totalR = filtered.reduce((sum, t) => sum + t.result_r, 0);
  const expectancyR = totalTrades > 0 ? totalR / totalTrades : 0;
  const avgR = expectancyR;

  const winningR = filtered
    .filter((_, i) => categories[i] === "win")
    .reduce((sum, t) => sum + t.result_r, 0);
  const losingR = filtered
    .filter((_, i) => categories[i] === "loss")
    .reduce((sum, t) => sum + t.result_r, 0);
  const profitFactor = losingR !== 0 ? winningR / Math.abs(losingR) : winningR > 0 ? Infinity : 0;

  const avgWinR = wins > 0 ? winningR / wins : 0;
  const avgLossR = losses > 0 ? losingR / losses : 0;

  const equityCurve = computeEquityCurve(filtered);
  const { maxDrawdownR, tradeCount: maxDrawdownTradeCount } = computeMaxDrawdown(equityCurve);
  const recoveryFactor = maxDrawdownR !== 0 ? totalR / Math.abs(maxDrawdownR) : totalR > 0 ? Infinity : 0;

  const { maxWinStreak, maxLossStreak, currentStreak } = computeStreaks(categories, beBreaksStreak);

  const resultRs = filtered.map((t) => t.result_r);
  const largestWin = resultRs.length > 0 ? Math.max(...resultRs, 0) : 0;
  const largestLoss = resultRs.length > 0 ? Math.min(...resultRs, 0) : 0;

  const byVariable: Record<string, VariableBucketStats[]> = {};
  for (const variable of options.variables ?? []) {
    if (variable.type !== "text") continue;
    byVariable[variable.id] = variable.values.map((v) =>
      computeVariableBucket(filtered, variable.id, v.id, v.label, v.icon, v.color, options.customResults),
    );
  }

  return {
    totalTrades,
    wins,
    losses,
    breakEvens,
    winRatePct,
    beRatePct,
    expectancyR,
    totalR,
    profitFactor,
    avgR,
    maxDrawdownR,
    maxDrawdownTradeCount,
    recoveryFactor,
    maxWinStreak,
    maxLossStreak,
    currentStreak,
    largestWin,
    largestLoss,
    avgWinR,
    avgLossR,
    equityCurve,
    filteredTrades: filtered,
    byVariable,
  };
}
