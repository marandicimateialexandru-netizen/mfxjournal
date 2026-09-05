import { callClaude, type AiMessage } from "./aiClient";
import type { StatsResult } from "@/features/stats/types";

export const QUICK_PROMPTS = [
  "Best Strategy",
  "Cross-Reference",
  "Reality Report",
  "Cut the Losers",
  "Prop Firm Ready?",
  "Best Days",
  "This Week's Plan",
  "Risk Check",
  "Recent vs Overall",
  "Pattern Analysis",
  "Losing Streaks",
];

const PERSONA = `You are the MFXJournal Trading Analyst: AI-powered, analyzing trading performance with rigorous statistical precision. Data over feelings, no sugarcoating.

Always respond in this format:
1. A short intro line (1 sentence).
2. A "Quick scorecard" section: 2-3 bullet-style stat lines.
3. One or more markdown tables with EXACTLY these columns: Variable | Trades | WR% | BE% | Avg R | Expectancy | Verdict
   - Verdict is one of: STRONG, WEAK, EDGE, NEED DATA — driven by sample size and effect size (n<15 always gets "(Anecdotal)" appended).
4. A closing 1-2 sentence plain-English takeaway per table.

You are given pre-computed, exactly-correct stats tables below — never invent numbers, always cite from what's given.`;

export function buildStatsPayload(stats: StatsResult, mode: "quick" | "detailed") {
  const base = {
    totalTrades: stats.totalTrades,
    winRatePct: stats.winRatePct,
    beRatePct: stats.beRatePct,
    expectancyR: stats.expectancyR,
    profitFactor: stats.profitFactor,
    maxDrawdownR: stats.maxDrawdownR,
    maxWinStreak: stats.maxWinStreak,
    maxLossStreak: stats.maxLossStreak,
    byVariable: Object.fromEntries(
      Object.entries(stats.byVariable).map(([id, buckets]) => [
        id,
        buckets.map((b) => ({
          label: b.label,
          tradeCount: b.tradeCount,
          winRatePct: b.winRatePct,
          beRatePct: b.beRatePct,
          avgR: b.avgR,
          totalR: b.totalR,
        })),
      ]),
    ),
  };
  if (mode === "quick") return base;
  return {
    ...base,
    recentTrades: stats.filteredTrades.slice(-20).map((t) => ({
      date: t.entry_time,
      outcome: t.outcome,
      resultR: t.result_r,
      market: t.market,
    })),
  };
}

export async function askTradingAnalyst(
  apiKey: string | null | undefined,
  question: string,
  stats: StatsResult,
  mode: "quick" | "detailed",
  history: AiMessage[] = [],
): Promise<string> {
  const payload = buildStatsPayload(stats, mode);
  const messages: AiMessage[] = [
    ...history,
    { role: "user", content: `Pre-computed stats: ${JSON.stringify(payload)}\n\nQuestion: ${question}` },
  ];
  const result = await callClaude({
    apiKey,
    system: PERSONA,
    messages,
    maxTokens: mode === "detailed" ? 2000 : 900,
  });
  return result.text;
}
