import type { Trade, CustomResult } from "@/db/types";
import type { StatsResult, VariableBucketStats } from "@/features/stats/types";
import { dayOfWeekBuckets } from "@/features/stats/pseudoVariables";
import { resolveOutcomeCategory } from "@/features/stats/computeStats";
import type { VariableWithValues } from "@/db/queries/variables";

export type PatternSentiment = "positive" | "negative" | "neutral";

export interface DetectedPattern {
  text: string;
  lowConfidence: boolean;
  category: string;
  /** Whether this pattern is an edge to lean into, a leak to fix, or just informational. Drives the
   *  Pattern Explorer's badge/color and lets a tip be written at the source instead of guessed later
   *  from the text. */
  sentiment: PatternSentiment;
  /** A concrete next action, written specifically for this pattern instance (not a generic template)
   *  so the Pattern Explorer always has something actionable to show, not just the observation. */
  tip: string;
}

const MIN_SAMPLE = 5;
const LOW_CONFIDENCE_THRESHOLD = 15;
const PER_SENTIMENT_TARGET = 3;

function lowConfidenceSuffix(n: number): string {
  return n < LOW_CONFIDENCE_THRESHOLD ? " (lower confidence, small sample)" : "";
}

function bestWorst(buckets: VariableBucketStats[]): { best?: VariableBucketStats; worst?: VariableBucketStats } {
  const eligible = buckets.filter((b) => b.tradeCount >= MIN_SAMPLE);
  if (eligible.length === 0) return {};
  const sorted = [...eligible].sort((a, b) => b.avgR - a.avgR);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

interface TagRef {
  variableId: string;
  valueId: string;
  label: string;
}

function hasTag(trade: Trade, tag: TagRef): boolean {
  return !!trade.variableValues?.[tag.variableId]?.valueIds?.includes(tag.valueId);
}

function winRateOf(trades: Trade[], customResults: CustomResult[]): number | null {
  const categories = trades.map((t) => resolveOutcomeCategory(t.outcome, customResults));
  const wins = categories.filter((c) => c === "win").length;
  const losses = categories.filter((c) => c === "loss").length;
  return wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;
}

const MAX_TAGS_FOR_COMBINATIONS = 60; // ~1,770 pairs — a safety cap, not a realistic ceiling for a personal journal's taxonomy
const MAX_COMBINATION_CANDIDATES = 5; // per sentiment, pushed into the pool before the usual top-3 ranking
const MIN_COMBINATION_EDGE = 8; // percentage points above/below baseline before a combination is worth surfacing at all

/** The one genuinely new analysis this file didn't already do: not "which single tag performs best"
 *  (the per-variable block above already covers that) but "does TAGGING TWO THINGS TOGETHER do
 *  better or worse than either alone" — e.g. Local Liquidity + a Minor Sweep both present on the same
 *  trade. Works for any two tags across any two variables, not just within one multi-tag variable;
 *  a same-variable pair (two Liquidity values together) can only ever match on a trade for a variable
 *  that actually allows multiple tags (Liquidity/News) — for a single-select variable the intersection
 *  is always empty and the pair is silently skipped by the MIN_SAMPLE gate below, no special-casing
 *  needed. Candidates feed into the same positive/negative pools as everything else in this file, so
 *  they compete fairly with day-of-week/streak/single-variable findings for the final top-3 slots. */
function combinationPairCandidates(
  trades: Trade[],
  variables: VariableWithValues[],
  customResults: CustomResult[],
  overallWinRate: number,
): { positive: DetectedPattern[]; negative: DetectedPattern[] } {
  const tags: TagRef[] = [];
  for (const v of variables) {
    if (v.type !== "text") continue;
    for (const val of v.values) tags.push({ variableId: v.id, valueId: val.id, label: val.label });
  }
  if (tags.length > MAX_TAGS_FOR_COMBINATIONS) return { positive: [], negative: [] };

  const pairs: { a: TagRef; b: TagRef; count: number; winRate: number; deviation: number }[] = [];
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const a = tags[i];
      const b = tags[j];
      const matching = trades.filter((t) => hasTag(t, a) && hasTag(t, b));
      if (matching.length < MIN_SAMPLE) continue;
      const winRate = winRateOf(matching, customResults);
      if (winRate == null) continue;
      pairs.push({ a, b, count: matching.length, winRate, deviation: winRate - overallWinRate });
    }
  }

  const positive: DetectedPattern[] = [];
  const negative: DetectedPattern[] = [];

  for (const p of [...pairs].sort((x, y) => y.deviation - x.deviation).slice(0, MAX_COMBINATION_CANDIDATES)) {
    if (p.deviation < MIN_COMBINATION_EDGE) break;
    const soloA = winRateOf(trades.filter((t) => hasTag(t, p.a)), customResults);
    const soloB = winRateOf(trades.filter((t) => hasTag(t, p.b)), customResults);
    if ((soloA != null && p.winRate <= soloA) || (soloB != null && p.winRate <= soloB)) continue;
    const comparison =
      soloA != null && soloB != null ? ` — beats either alone (${p.a.label} solo: ${soloA.toFixed(0)}%, ${p.b.label} solo: ${soloB.toFixed(0)}%)` : "";
    positive.push({
      category: "combination",
      sentiment: "positive",
      lowConfidence: p.count < LOW_CONFIDENCE_THRESHOLD,
      text: `Trades tagged both ${p.a.label} and ${p.b.label} win at ${p.winRate.toFixed(0)}% (${p.count} trades), +${p.deviation.toFixed(0)}pts above your ${overallWinRate.toFixed(0)}% baseline${comparison}.${lowConfidenceSuffix(p.count)}`,
      tip: `When ${p.a.label} and ${p.b.label} show up together, this is one of your strongest combinations — size and confidence can both lean up here.`,
    });
  }

  for (const p of [...pairs].sort((x, y) => x.deviation - y.deviation).slice(0, MAX_COMBINATION_CANDIDATES)) {
    if (p.deviation > -MIN_COMBINATION_EDGE) break;
    negative.push({
      category: "combination",
      sentiment: "negative",
      lowConfidence: p.count < LOW_CONFIDENCE_THRESHOLD,
      text: `Trades tagged both ${p.a.label} and ${p.b.label} win at just ${p.winRate.toFixed(0)}% (${p.count} trades), ${p.deviation.toFixed(0)}pts below your ${overallWinRate.toFixed(0)}% baseline.${lowConfidenceSuffix(p.count)}`,
      tip: `Watch for ${p.a.label} and ${p.b.label} appearing together — consider sitting that specific combination out until you understand what's dragging it down.`,
    });
  }

  return { positive, negative };
}

/** Detects patterns and buckets them by sentiment, always returning exactly 3 opportunities, 3
 *  needs-attention leaks, and 3 neutral insights (9 total) when there's enough data — instead of
 *  whatever uneven mix happened to trigger. Each bucket is built as a POOL: the most specific,
 *  data-driven candidates are pushed first (day-of-week outliers, per-variable edges, streak
 *  momentum...), and always-computable generic framings are pushed last as filler — so `.slice(0,3)`
 *  naturally prefers the interesting, specific findings and only reaches for a generic one when a
 *  trader's data genuinely doesn't produce three specific results in that sentiment. The three
 *  buckets are then interleaved (pos, neg, neutral, pos, neg, neutral...) so any prefix of the result
 *  — e.g. a smaller `cap` for a token-constrained AI context — still samples all three sentiments. */
export function detectPatterns(
  stats: StatsResult,
  trades: Trade[],
  variables: VariableWithValues[],
  customResults: CustomResult[] = [],
  cap = 9,
): DetectedPattern[] {
  if (stats.totalTrades < MIN_SAMPLE) return [];

  const positive: DetectedPattern[] = [];
  const negative: DetectedPattern[] = [];
  const neutral: DetectedPattern[] = [];

  const combos = combinationPairCandidates(stats.filteredTrades, variables, customResults, stats.winRatePct);
  positive.push(...combos.positive);
  negative.push(...combos.negative);

  const dowBuckets = dayOfWeekBuckets(trades).filter((b) => b.tradeCount >= MIN_SAMPLE);
  if (dowBuckets.length > 0) {
    const overallWinRate = stats.winRatePct;
    const sortedByWinRate = [...dowBuckets].sort((a, b) => b.winRatePct - a.winRatePct);
    const best = sortedByWinRate[0];
    const worst = sortedByWinRate[sortedByWinRate.length - 1];

    if (best && best.winRatePct > overallWinRate) {
      positive.push({
        category: "day-of-week",
        sentiment: "positive",
        lowConfidence: best.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${best.label} is your best day with ${best.winRatePct.toFixed(0)}% win rate${lowConfidenceSuffix(best.tradeCount)}.`,
        tip: `Consider concentrating more size or frequency on ${best.label}s — it's where your edge is strongest.`,
      });
    }
    if (worst && worst.winRatePct < overallWinRate && worst.label !== best?.label) {
      const deviation = overallWinRate - worst.winRatePct;
      negative.push({
        category: "day-of-week",
        sentiment: "negative",
        lowConfidence: worst.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${worst.label} performance is ${deviation.toFixed(0)}% below average (${worst.winRatePct.toFixed(0)}% win rate)${lowConfidenceSuffix(worst.tradeCount)}.`,
        tip: `Reduce size or sit out ${worst.label}s until you understand what's dragging that day down.`,
      });
    }

    const mostTraded = [...dowBuckets].sort((a, b) => b.tradeCount - a.tradeCount)[0];
    if (mostTraded) {
      neutral.push({
        category: "day-of-week",
        sentiment: "neutral",
        lowConfidence: false,
        text: `You trade most on ${mostTraded.label} (${mostTraded.tradeCount} trades, ${mostTraded.winRatePct.toFixed(0)}% win rate).`,
        tip: `Double-check that this frequency reflects genuine opportunity on ${mostTraded.label}s, not habit or boredom trading.`,
      });
    }
  }

  // Strongest / weakest setup per configured text variable — every qualifying variable adds its own
  // candidate, so a workspace with several tagged variables naturally builds a real pool here.
  for (const variable of variables) {
    if (variable.type !== "text") continue;
    const buckets = stats.byVariable[variable.id] ?? [];
    const { best, worst } = bestWorst(buckets);
    if (best && best.avgR > 0) {
      positive.push({
        category: "variable",
        sentiment: "positive",
        lowConfidence: best.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${best.label} is your strongest ${variable.label.toLowerCase()} (${best.avgR.toFixed(2)}R expectancy, ${best.winRatePct.toFixed(0)}% win rate)${lowConfidenceSuffix(best.tradeCount)}.`,
        tip: `Lean into ${best.label} setups — this is your highest-expectancy edge in ${variable.label.toLowerCase()}.`,
      });
    }
    if (worst && worst.avgR < 0 && worst.label !== best?.label) {
      negative.push({
        category: "variable",
        sentiment: "negative",
        lowConfidence: worst.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${worst.label} is losing money (${worst.avgR.toFixed(2)}R expectancy) — consider cutting it${lowConfidenceSuffix(worst.tradeCount)}.`,
        tip: `Cut ${worst.label} entirely for a month, or tighten the rules around when you take it, and re-check the numbers.`,
      });
    }
    // Whichever variable value gets tagged most often, regardless of performance — an always-available
    // neutral insight once at least one variable has any tagged trades.
    const mostUsed = [...buckets].filter((b) => b.tradeCount >= MIN_SAMPLE).sort((a, b) => b.tradeCount - a.tradeCount)[0];
    if (mostUsed) {
      neutral.push({
        category: "variable",
        sentiment: "neutral",
        lowConfidence: mostUsed.tradeCount < LOW_CONFIDENCE_THRESHOLD,
        text: `${mostUsed.label} is your most-used ${variable.label.toLowerCase()} (${mostUsed.tradeCount} trades, ${mostUsed.winRatePct.toFixed(0)}% win rate).`,
        tip: `Since this is your default go-to, make sure its rules are the sharpest of all your ${variable.label.toLowerCase()} options.`,
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
      positive.push({
        category: "streak",
        sentiment: "positive",
        lowConfidence: afterWin.total < LOW_CONFIDENCE_THRESHOLD,
        text: `You maintain momentum after winning streaks (+${(wrAfterWin - stats.winRatePct).toFixed(0)}% win rate)${lowConfidenceSuffix(afterWin.total)}.`,
        tip: `Keep trusting your process after a win — you're not chasing or oversizing into streaks, which is rare and valuable.`,
      });
    } else if (wrAfterWin < stats.winRatePct - 5) {
      negative.push({
        category: "streak",
        sentiment: "negative",
        lowConfidence: afterWin.total < LOW_CONFIDENCE_THRESHOLD,
        text: `Your win rate drops to ${wrAfterWin.toFixed(0)}% right after a win (vs ${stats.winRatePct.toFixed(0)}% overall) — a sign of overconfidence creeping in.`,
        tip: `Watch for sizing up or loosening your rules right after a winner — treat the next trade like any other.`,
      });
    }
  }
  if (afterLoss.total >= MIN_SAMPLE) {
    const wrAfterLoss = (afterLoss.wins / afterLoss.total) * 100;
    if (wrAfterLoss < stats.winRatePct - 5) {
      negative.push({
        category: "streak",
        sentiment: "negative",
        lowConfidence: afterLoss.total < LOW_CONFIDENCE_THRESHOLD,
        text: `Your win rate falls to ${wrAfterLoss.toFixed(0)}% right after a loss (vs ${stats.winRatePct.toFixed(0)}% overall) — a possible revenge-trading tell.`,
        tip: `After a loss, consider a short cooldown before the next entry rather than trading straight back in.`,
      });
    } else if (wrAfterLoss > stats.winRatePct + 5) {
      positive.push({
        category: "streak",
        sentiment: "positive",
        lowConfidence: afterLoss.total < LOW_CONFIDENCE_THRESHOLD,
        text: `You bounce back well: ${wrAfterLoss.toFixed(0)}% win rate right after a loss (vs ${stats.winRatePct.toFixed(0)}% overall).`,
        tip: `Whatever reset routine you use after a loss is working — keep it consistent.`,
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
      negative.push({
        category: "recent",
        sentiment: "negative",
        lowConfidence: true,
        text: `Recent slump: last ${recentN.length} trades at ${recentWinRate.toFixed(0)}% win rate (vs ${stats.winRatePct.toFixed(0)}% overall).`,
        tip: `Consider a short pause or cutting size in half until you're trading back above your average win rate.`,
      });
    } else if (recentWinRate > stats.winRatePct + 10) {
      positive.push({
        category: "recent",
        sentiment: "positive",
        lowConfidence: true,
        text: `Hot streak: last ${recentN.length} trades at ${recentWinRate.toFixed(0)}% win rate (vs ${stats.winRatePct.toFixed(0)}% overall).`,
        tip: `Stay disciplined on size — a hot streak is exactly when it's tempting to oversize and give it all back.`,
      });
    }
  }

  // Risk/reward framing
  if (stats.wins >= MIN_SAMPLE && stats.losses >= MIN_SAMPLE) {
    const rewardRatio = Math.abs(stats.avgLossR) > 0 ? stats.avgWinR / Math.abs(stats.avgLossR) : Infinity;
    if (rewardRatio >= 1) {
      positive.push({
        category: "risk-reward",
        sentiment: "positive",
        lowConfidence: false,
        text: `Strong risk/reward: winners average ${stats.avgWinR.toFixed(2)}R vs ${Math.abs(stats.avgLossR).toFixed(2)}R losers.`,
        tip: `Protect this edge by keeping stops disciplined — your winners funding your losers is what makes a sub-50% win rate still profitable.`,
      });
    } else {
      negative.push({
        category: "risk-reward",
        sentiment: "negative",
        lowConfidence: false,
        text: `Your losers (${Math.abs(stats.avgLossR).toFixed(2)}R avg) are bigger than your winners (${stats.avgWinR.toFixed(2)}R avg) — you need a high win rate just to break even.`,
        tip: `Look for ways to cut losers earlier or let winners run longer to flip this ratio in your favor.`,
      });
    }
  }

  // --- Guaranteed generic fallbacks per sentiment, appended last so specific findings above always
  // win the top 3 slots when they exist. These stay truthful (real numbers from `stats`) even when
  // generic, they just don't point at one specific day/variable/streak. ---

  if (stats.beRatePct > 0) {
    neutral.push({
      category: "risk-reward",
      sentiment: "neutral",
      lowConfidence: false,
      text: `${stats.beRatePct.toFixed(0)}% of your trades close break-even (${stats.breakEvens} of ${stats.totalTrades}).`,
      tip: `Review a few break-even trades — they often reveal an entry or stop-placement habit worth tightening.`,
    });
  }
  neutral.push({
    category: "risk-reward",
    sentiment: "neutral",
    lowConfidence: false,
    text: `Your profit factor is ${Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "infinite (no losses yet)"} — you make that many dollars for every dollar you lose.`,
    tip: `Anything above 1.5 is generally considered solid; track this number over time more than any single trade.`,
  });
  neutral.push({
    category: "risk-reward",
    sentiment: "neutral",
    lowConfidence: false,
    text: `Expectancy of ${stats.expectancyR >= 0 ? "+" : ""}${stats.expectancyR.toFixed(2)}R per trade means every 100 trades should net roughly ${(stats.expectancyR * 100).toFixed(0)}R, assuming your edge holds.`,
    tip: `Expectancy is the number that matters most long-run — a good trade can still lose, and a bad trade can still win.`,
  });

  if (Number.isFinite(stats.recoveryFactor) && stats.recoveryFactor > 0) {
    positive.push({
      category: "risk-reward",
      sentiment: "positive",
      lowConfidence: false,
      text: `Recovery factor of ${stats.recoveryFactor.toFixed(2)} — you've made ${stats.recoveryFactor.toFixed(1)}x your worst drawdown back in total profit.`,
      tip: `A recovery factor above 2 is a healthy sign your edge outweighs your drawdowns; keep monitoring it as you scale size.`,
    });
  }
  positive.push({
    category: "risk-reward",
    sentiment: "positive",
    lowConfidence: false,
    text: `Your largest win (+${stats.largestWin.toFixed(2)}R) shows your process can capture an outsized move when a setup really lines up.`,
    tip: `Look back at that trade's setup and conditions — see what made it work and whether it's repeatable.`,
  });
  positive.push({
    category: "risk-reward",
    sentiment: "positive",
    lowConfidence: false,
    text: `You've logged ${stats.totalTrades} trades — enough of a sample to trust these statistics over gut feel.`,
    tip: `Keep journaling with the same discipline; every additional 50-100 trades makes these numbers more reliable.`,
  });

  if (stats.maxLossStreak >= 3) {
    negative.push({
      category: "streak",
      sentiment: "negative",
      lowConfidence: false,
      text: `Your longest losing streak ran ${stats.maxLossStreak} trades in a row — long enough to test discipline and account size.`,
      tip: `Pre-decide a "stop trading for the day" rule after 2-3 losses in a row, before it happens again.`,
    });
  }
  negative.push({
    category: "risk-reward",
    sentiment: "negative",
    lowConfidence: false,
    text: `Your largest single loss (${stats.largestLoss.toFixed(2)}R) is ${Math.abs(stats.avgLossR) > 0 ? (Math.abs(stats.largestLoss) / Math.abs(stats.avgLossR)).toFixed(1) : "?"}x your average loser.`,
    tip: `A single outsized loss can undo many winners — double-check your stop discipline on the trade type that produced it.`,
  });
  negative.push({
    category: "risk-reward",
    sentiment: "negative",
    lowConfidence: false,
    text: `Your max drawdown of ${stats.maxDrawdownR.toFixed(2)}R took ${stats.maxDrawdownTradeCount} trades to work through.`,
    tip: `Compare this to your current streak — if you're underwater right now, this is your reference for how long recovery can take.`,
  });

  const rank = (p: DetectedPattern) => (p.lowConfidence ? 1 : 0);
  const top3 = (pool: DetectedPattern[]) =>
    pool
      .map((p, i) => ({ p, i }))
      .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
      .slice(0, PER_SENTIMENT_TARGET)
      .map((x) => x.p);

  const posTop = top3(positive);
  const negTop = top3(negative);
  const neuTop = top3(neutral);

  const interleaved: DetectedPattern[] = [];
  for (let i = 0; i < PER_SENTIMENT_TARGET; i++) {
    if (posTop[i]) interleaved.push(posTop[i]);
    if (negTop[i]) interleaved.push(negTop[i]);
    if (neuTop[i]) interleaved.push(neuTop[i]);
  }

  return interleaved.slice(0, cap);
}
