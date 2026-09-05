import type { Trade } from "@/db/types";
import type { StatsResult, VariableBucketStats } from "@/features/stats/types";
import { dayOfWeekBuckets } from "@/features/stats/pseudoVariables";
import type { VariableWithValues } from "@/db/queries/variables";

export interface DetectedPattern {
  text: string;
  lowConfidence: boolean;
  category: string;
}

const MIN_SAMPLE = 5;
const LOW_CONFIDENCE_THRESHOLD = 15;

function lowConfidenceSuffix(n: number): string {
  return n < LOW_CONFIDENCE_THRESHOLD ? " (lower confidence, small sample)" : "";
}

function bestWorst(buckets: VariableBucketStats[]): { best?: VariableBucketStats; worst?: VariableBucketStats } {
  const eligible = buckets.filter((b) => b.tradeCount >= MIN_SAMPLE);
  if (eligible.length === 0) return {};
  const sorted = [...eligible].sort((a, b) => b.avgR - a.avgR);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function detectPatterns(
  stats: StatsResult,
  trades: Trade[],
  variables: VariableWithValues[],
  cap = 8,
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Day-of-week outliers
  const dowBuckets = dayOfWeekBuckets(trades).filter((b) => b.tradeCount >= MIN_SAMPLE);
  if (dowBuckets.length > 0) {
    const overallWinRate = stats.winRatePct;
    const sortedByWinRate = [...dowBuckets].sort((a, b) => b.winRatePct - a.winRatePct);
    const best = sortedByWinRate[0];
    const worst = sortedByWinRate[sortedByWinRate.length - 1];

    if (best && best.winRatePct > overallWinRate) {
      patterns.push({
        category: "day-of-week",
        lowConfidence: best.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${best.label} is your best day with ${best.winRatePct.toFixed(0)}% win rate${lowConfidenceSuffix(best.tradeCount)}.`,
      });
    }
    if (worst && worst.winRatePct < overallWinRate && worst.label !== best?.label) {
      const deviation = overallWinRate - worst.winRatePct;
      patterns.push({
        category: "day-of-week",
        lowConfidence: worst.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${worst.label} performance is ${deviation.toFixed(0)}% below average (${worst.winRatePct.toFixed(0)}% win rate)${lowConfidenceSuffix(worst.tradeCount)}.`,
      });
    }

    const mostTraded = [...dowBuckets].sort((a, b) => b.tradeCount - a.tradeCount)[0];
    if (mostTraded) {
      patterns.push({
        category: "day-of-week",
        lowConfidence: false,
        text: `You trade most on ${mostTraded.label} (${mostTraded.tradeCount} trades, ${mostTraded.winRatePct.toFixed(0)}% win rate).`,
      });
    }
  }

  // Strongest / weakest setup per configured text variable
  for (const variable of variables) {
    if (variable.type !== "text") continue;
    const buckets = stats.byVariable[variable.id] ?? [];
    const { best, worst } = bestWorst(buckets);
    if (best && best.avgR > 0) {
      patterns.push({
        category: "variable",
        lowConfidence: best.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${best.label} is your strongest ${variable.label.toLowerCase()} (${best.avgR.toFixed(2)}R expectancy, ${best.winRatePct.toFixed(0)}% win rate)${lowConfidenceSuffix(best.tradeCount)}.`,
      });
    }
    if (worst && worst.avgR < 0 && worst.label !== best?.label) {
      patterns.push({
        category: "variable",
        lowConfidence: worst.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${worst.label} is losing money (${worst.avgR.toFixed(2)}R expectancy) — consider cutting it${lowConfidenceSuffix(worst.tradeCount)}.`,
      });
    }
  }

  // Streak momentum: win rate on trades immediately following a win vs a loss
  const sorted = [...trades].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime());
  let afterWin = { wins: 0, total: 0 };
  let afterLoss = { wins: 0, total: 0 };
  for (let i = 1; i < sorted.length; i++) {
    const prevWin = sorted[i - 1].outcome === "win";
    const prevLoss = sorted[i - 1].outcome === "loss";
    const curWin = sorted[i].outcome === "win";
    const curLoss = sorted[i].outcome === "loss";
    if (!curWin && !curLoss) continue;
    if (prevWin) {
      afterWin.total += 1;
      if (curWin) afterWin.wins += 1;
    } else if (prevLoss) {
      afterLoss.total += 1;
      if (curWin) afterLoss.wins += 1;
    }
  }
  if (afterWin.total >= MIN_SAMPLE) {
    const wrAfterWin = (afterWin.wins / afterWin.total) * 100;
    if (wrAfterWin > stats.winRatePct + 5) {
      patterns.push({
        category: "streak",
        lowConfidence: afterWin.total < LOW_CONFIDENCE_THRESHOLD,
        text: `You maintain momentum after winning streaks (+${(wrAfterWin - stats.winRatePct).toFixed(0)}% win rate)${lowConfidenceSuffix(afterWin.total)}.`,
      });
    }
  }

  // Recent slump / hot streak
  const recentN = sorted.slice(-10);
  if (recentN.length >= MIN_SAMPLE) {
    const recentWins = recentN.filter((t) => t.outcome === "win").length;
    const recentLosses = recentN.filter((t) => t.outcome === "loss").length;
    const recentWinRate = recentWins + recentLosses > 0 ? (recentWins / (recentWins + recentLosses)) * 100 : 0;
    if (recentWinRate < stats.winRatePct - 10) {
      patterns.push({
        category: "recent",
        lowConfidence: true,
        text: `Recent slump: last ${recentN.length} trades at ${recentWinRate.toFixed(0)}% win rate (vs ${stats.winRatePct.toFixed(0)}% overall).`,
      });
    } else if (recentWinRate > stats.winRatePct + 10) {
      patterns.push({
        category: "recent",
        lowConfidence: true,
        text: `Hot streak: last ${recentN.length} trades at ${recentWinRate.toFixed(0)}% win rate (vs ${stats.winRatePct.toFixed(0)}% overall).`,
      });
    }
  }

  // Risk/reward framing
  if (stats.wins >= MIN_SAMPLE && stats.losses >= MIN_SAMPLE) {
    patterns.push({
      category: "risk-reward",
      lowConfidence: false,
      text: `Strong risk/reward: winners average ${stats.avgWinR.toFixed(2)}R vs ${Math.abs(stats.avgLossR).toFixed(2)}R losers.`,
    });
  }

  return patterns.slice(0, cap);
}
