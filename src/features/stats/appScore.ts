import type { StatsResult } from "./types";

export const APP_SCORE_WEIGHTS = {
  winRate: 0.15,
  profitFactor: 0.2,
  avgWinLossRatio: 0.15,
  recoveryFactor: 0.15,
  maxDrawdown: 0.2, // inverted
  consistency: 0.15, // inverted (variance of returns)
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return value > 0 ? 100 : 0;
  return clamp(((value - min) / (max - min)) * 100);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export interface AppScoreBreakdown {
  score: number;
  subScores: { key: keyof typeof APP_SCORE_WEIGHTS; label: string; value: number; weight: number }[];
}

export function computeAppScore(stats: StatsResult): AppScoreBreakdown {
  const winRateScore = normalize(stats.winRatePct, 0, 100);
  const profitFactorScore = normalize(stats.profitFactor, 0, 3);
  const avgWinLossRatio = stats.avgLossR !== 0 ? Math.abs(stats.avgWinR / stats.avgLossR) : stats.avgWinR > 0 ? 3 : 0;
  const avgWinLossScore = normalize(avgWinLossRatio, 0, 3);
  const recoveryFactorScore = normalize(stats.recoveryFactor, 0, 5);
  const maxDrawdownScore = 100 - normalize(stats.maxDrawdownR, 0, Math.max(stats.totalR, 10));
  const returns = stats.filteredTrades.map((t) => t.result_r);
  const variance = stdDev(returns);
  const consistencyScore = 100 - normalize(variance, 0, 3);

  const subScores: AppScoreBreakdown["subScores"] = [
    { key: "winRate", label: "Win %", value: winRateScore, weight: APP_SCORE_WEIGHTS.winRate },
    { key: "profitFactor", label: "Profit Factor", value: profitFactorScore, weight: APP_SCORE_WEIGHTS.profitFactor },
    { key: "avgWinLossRatio", label: "Avg Win/Loss Ratio", value: avgWinLossScore, weight: APP_SCORE_WEIGHTS.avgWinLossRatio },
    { key: "recoveryFactor", label: "Recovery Factor", value: recoveryFactorScore, weight: APP_SCORE_WEIGHTS.recoveryFactor },
    { key: "maxDrawdown", label: "Max Drawdown", value: maxDrawdownScore, weight: APP_SCORE_WEIGHTS.maxDrawdown },
    { key: "consistency", label: "Consistency", value: consistencyScore, weight: APP_SCORE_WEIGHTS.consistency },
  ];

  const score = subScores.reduce((sum, s) => sum + s.value * s.weight, 0);

  return { score: clamp(score), subScores };
}
