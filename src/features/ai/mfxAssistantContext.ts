import { format } from "date-fns";
import type { Trade, CustomResult, Market, StreakThreshold, Settings } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";
import type { StatsResult, VariableBucketStats } from "@/features/stats/types";
import { computeStats } from "@/features/stats/computeStats";
import { dayOfWeekBuckets, timeOfDayBuckets, marketBuckets, streakBuckets } from "@/features/stats/pseudoVariables";
import { detectPatterns } from "@/features/patterns/detectedPatterns";

const RECENT_TRADE_LIMIT = 60;
const COMPACT_RECENT_TRADE_LIMIT = 12;
const COMPACT_NOTE_CHARS = 50;
const COMPACT_MONTH_LIMIT = 6;
const COMPACT_BUCKET_LIMIT = 10;
const COMPACT_PATTERN_LIMIT = 6;
const COMPACT_VARIABLE_LIMIT = 5;

export interface AssistantContextInput {
  stats: StatsResult;
  trades: Trade[];
  variables: VariableWithValues[];
  customResults: CustomResult[];
  markets: Market[];
  streakThresholds: StreakThreshold[];
  settings: Settings | undefined;
  /** Free tiers on some providers (Groq's 8,000 tokens-per-minute cap, notably) can't fit the full
   *  data dump this normally builds. Compact mode drastically trims trade-ledger size, note length,
   *  and bucket counts so the same assistant still runs, just with less depth per turn. */
  compact?: boolean;
}

function fmtR(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}R`;
}

function resolveTags(trade: Trade, variables: VariableWithValues[]): string {
  if (!trade.variableValues) return "";
  const parts: string[] = [];
  for (const v of variables) {
    const entry = trade.variableValues[v.id];
    if (!entry) continue;
    if (v.type === "number" && entry.numberValue != null) {
      parts.push(`${v.label}=${entry.numberValue}`);
    } else if (entry.valueId) {
      const val = v.values.find((x) => x.id === entry.valueId);
      if (val) parts.push(`${v.label}=${val.label}`);
    }
  }
  return parts.join(", ");
}

function tradeLine(t: Trade, variables: VariableWithValues[], index: number, noteChars: number): string {
  const date = format(new Date(t.entry_time), "yyyy-MM-dd HH:mm");
  const durationMin = t.end_time ? Math.round((new Date(t.end_time).getTime() - new Date(t.entry_time).getTime()) / 60000) : null;
  const tags = resolveTags(t, variables);
  const note = t.notes ? t.notes.replace(/\s+/g, " ").trim().slice(0, noteChars) : "";
  const bits = [
    `#${index + 1}`,
    date,
    t.market ?? "—",
    t.outcome.toUpperCase(),
    fmtR(t.result_r),
    durationMin != null ? `${durationMin}m` : null,
    tags || null,
    note ? `note: "${note}"` : null,
  ].filter(Boolean);
  return bits.join(" | ");
}

/** `limit` keeps compact mode's buckets bounded: sorted by trade count (the most-traded values are
 *  the most statistically meaningful anyway) so trimming loses the least-informative rows first. */
function bucketLines(buckets: VariableBucketStats[], limit?: number): string {
  let rows = buckets.filter((b) => b.tradeCount > 0);
  if (limit != null && rows.length > limit) {
    rows = [...rows].sort((a, b) => b.tradeCount - a.tradeCount).slice(0, limit);
  }
  return rows.map((b) => `- ${b.label}: ${b.tradeCount} trades, ${b.winRatePct.toFixed(0)}% WR, ${fmtR(b.totalR)} total`).join("\n");
}

/** Builds the full system prompt: persona + instructions + a complete, exact data dump of the
 *  trader's stats, breakdowns, patterns, and recent trade ledger. This is the "brain" — everything
 *  the assistant is allowed to reason from lives in this one string, rebuilt fresh from the same
 *  canonical stats engine every other page uses, so it can never drift from what the app itself shows. */
export function buildAssistantSystemPrompt(input: AssistantContextInput): string {
  const { stats, trades, variables, customResults, markets, streakThresholds, settings, compact = false } = input;
  const all = stats.filteredTrades;
  const bucketLimit = compact ? COMPACT_BUCKET_LIMIT : undefined;

  const recent7 = computeStats(all.filter((t) => new Date(t.entry_time).getTime() >= Date.now() - 7 * 86400000), { customResults });
  const recent30 = computeStats(all.filter((t) => new Date(t.entry_time).getTime() >= Date.now() - 30 * 86400000), { customResults });

  let monthly = (() => {
    const keys = [...new Set(all.map((t) => format(new Date(t.entry_time), "yyyy-MM")))].sort();
    return keys.map((key) => ({
      label: format(new Date(key + "-01"), "MMM yyyy"),
      ...computeStats(
        all.filter((t) => format(new Date(t.entry_time), "yyyy-MM") === key),
        { customResults },
      ),
    }));
  })();
  if (compact) monthly = monthly.slice(-COMPACT_MONTH_LIMIT);

  const dow = dayOfWeekBuckets(all, customResults);
  const tod = timeOfDayBuckets(all, { windowMinutes: 60, calculateBy: "start" }, customResults);
  const marketB = markets.length > 0 ? marketBuckets(all, markets, customResults) : [];
  const streakEnabled = !!settings?.streak_analysis_enabled && streakThresholds.length > 0;
  const streaks = streakEnabled
    ? streakBuckets(all, { thresholds: streakThresholds, beBreaksStreak: !!(settings?.streak_be_breaks_streak ?? 1) }, customResults)
    : [];

  const patterns = detectPatterns(stats, trades, variables, compact ? COMPACT_PATTERN_LIMIT : 12);
  let textVariables = variables.filter((v) => v.type === "text");
  if (compact && textVariables.length > COMPACT_VARIABLE_LIMIT) {
    // Keep whichever variables actually have tagged trades, most-used first — an untagged or
    // barely-used variable isn't worth its share of a tiny 8k-token budget.
    textVariables = [...textVariables]
      .sort((a, b) => (stats.byVariable[b.id] ?? []).reduce((n, x) => n + x.tradeCount, 0) - (stats.byVariable[a.id] ?? []).reduce((n, x) => n + x.tradeCount, 0))
      .slice(0, COMPACT_VARIABLE_LIMIT);
  }
  const recentTradeLimit = compact ? COMPACT_RECENT_TRADE_LIMIT : RECENT_TRADE_LIMIT;
  const noteChars = compact ? COMPACT_NOTE_CHARS : 120;
  const recentTrades = all.slice(-recentTradeLimit);
  const omittedCount = Math.max(0, all.length - recentTrades.length);

  return `You are the MFX AI Assistant — a personal trading coach built into MFXJournal, a trading journal app. You have been given complete, exact data below covering this trader's entire journal: every core statistic, their performance broken down by day, hour, month, market, tagged variable, and streak context, detected patterns, and a ledger of their most recent trades including notes.

You also have a query_trades tool that computes an exact win rate/avg R/total R for ANY combination of filters (a tagged variable value, an hour range, a day of week, a market) live against the trader's real trades. The breakdowns below are all single-dimension (day OR hour OR variable, never two at once) — whenever a question crosses two or more of those dimensions together (e.g. "which setup wins most at 12:00", "how does EURUSD perform on Fridays"), call query_trades instead of saying that breakdown isn't available. It always is.

Your job:
- Answer using ONLY the real numbers given below or returned by query_trades — never invent or estimate a statistic.
- Be a coach, not a search engine: give tips, flag mistakes, and explain WHY a number looks the way it does, tying it back to specific data points.
- When you spot something concerning (a losing pattern, overtrading, a variable that's bleeding R, a streak-driven tilt), say so plainly and suggest a concrete next step — don't just describe it.
- Teach: briefly explain trading concepts (expectancy, drawdown, profit factor, R-multiples) in plain language when it helps the point land, without being condescending.
- All performance figures are in R-multiples (multiples of the trader's initial risk per trade) unless stated otherwise.
- Keep answers focused and readable: short paragraphs, bullet points where useful, no filler.
- If asked about something outside this data (unrelated topics), gently redirect back to trading/journal territory.
- If a screenshot/chart image is attached to the user's message, analyze it directly (price action, setup quality, entries/exits) alongside the journal data below.
${compact ? "- STRICT LENGTH LIMIT: you are on a tiny token budget. Keep your visible answer to 80 words or less — 2-3 short bullet points, never a full report. Running long and never reaching the block below is a failure, worse than being brief.\n" : ""}
After your visible answer, on its own new line, output exactly this marker followed by a JSON array of exactly 2 short, specific follow-up questions (each under 70 characters) the trader could naturally ask next, grounded in their real data and what you just said. Never skip this block, even if it means cutting the answer above shorter to make room. Never mention or explain it in your visible answer — it is a hidden control block the app parses out.
---SUGGESTIONS---
["...", "..."]

=== TRADER'S DATA ===

CORE STATS (all-time, ${stats.totalTrades} trades)
- Win rate: ${stats.winRatePct.toFixed(1)}% | BE rate: ${stats.beRatePct.toFixed(1)}%
- Expectancy: ${fmtR(stats.expectancyR)} per trade | Avg R: ${fmtR(stats.avgR)}
- Total R gained: ${fmtR(stats.totalR)} | Profit factor: ${Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"}
- Max drawdown: ${stats.maxDrawdownR.toFixed(2)}R over ${stats.maxDrawdownTradeCount} trades | Recovery factor: ${Number.isFinite(stats.recoveryFactor) ? stats.recoveryFactor.toFixed(2) : "∞"}
- Max win streak: ${stats.maxWinStreak} | Max loss streak: ${stats.maxLossStreak} | Current streak: ${stats.currentStreak.type === "none" ? "none" : `${stats.currentStreak.count} ${stats.currentStreak.type}`}
- Avg winner: ${fmtR(stats.avgWinR)} | Avg loser: ${fmtR(stats.avgLossR)} | Largest win: ${fmtR(stats.largestWin)} | Largest loss: ${fmtR(stats.largestLoss)}

RECENT ACTIVITY
- Last 7 days: ${recent7.totalTrades} trades, ${recent7.winRatePct.toFixed(0)}% WR, ${fmtR(recent7.totalR)} total
- Last 30 days: ${recent30.totalTrades} trades, ${recent30.winRatePct.toFixed(0)}% WR, ${fmtR(recent30.totalR)} total

MONTHLY BREAKDOWN
${monthly.map((m) => `- ${m.label}: ${m.totalTrades} trades, ${m.winRatePct.toFixed(0)}% WR, ${fmtR(m.totalR)} total`).join("\n") || "(no data)"}

DAY OF WEEK
${bucketLines(dow, bucketLimit) || "(no data)"}

TIME OF DAY (by hour, local time)
${bucketLines(tod, bucketLimit) || "(no data)"}

${marketB.length > 0 ? `MARKETS TRADED\n${bucketLines(marketB, bucketLimit)}\n\n` : ""}${streaks.length > 0 ? `STREAK CONTEXT (performance right after a win/loss streak)\n${bucketLines(streaks, bucketLimit)}\n\n` : ""}VARIABLE PERFORMANCE
${textVariables.map((v) => `${v.label}:\n${bucketLines(stats.byVariable[v.id] ?? [], bucketLimit) || "  (no tagged trades)"}`).join("\n\n") || "(no variables configured)"}

DETECTED PATTERNS
${patterns.map((p) => `- ${p.text}`).join("\n") || "(none detected yet)"}

RECENT TRADE LEDGER (most recent ${recentTrades.length}${omittedCount > 0 ? ` of ${all.length} total — earlier trades are fully reflected in the aggregate stats above` : ""})
${recentTrades.map((t, i) => tradeLine(t, variables, i, noteChars)).join("\n") || "(no trades logged yet)"}
`;
}
