import type { Trade, CustomResult } from "@/db/types";
import type { VariableBucketStats } from "./types";
import { resolveOutcomeCategory } from "./computeStats";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function bucketFromTrades(
  key: string,
  label: string,
  bucketTrades: Trade[],
  customResults: CustomResult[] | undefined,
): VariableBucketStats {
  const categories = bucketTrades.map((t) => resolveOutcomeCategory(t.outcome, customResults));
  const wins = categories.filter((c) => c === "win").length;
  const losses = categories.filter((c) => c === "loss").length;
  const bes = categories.filter((c) => c === "be").length;
  const totalR = bucketTrades.reduce((sum, t) => sum + t.result_r, 0);
  return {
    valueId: key,
    label,
    icon: null,
    color: null,
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

export function dayOfWeekBuckets(trades: Trade[], customResults?: CustomResult[]): VariableBucketStats[] {
  return DAY_LABELS.map((label, dayIndex) => {
    const bucketTrades = trades.filter((t) => new Date(t.entry_time).getDay() === dayIndex);
    return bucketFromTrades(String(dayIndex), label, bucketTrades, customResults);
  });
}

export function monthBuckets(trades: Trade[], customResults?: CustomResult[]): VariableBucketStats[] {
  return MONTH_LABELS.map((label, monthIndex) => {
    const bucketTrades = trades.filter((t) => new Date(t.entry_time).getMonth() === monthIndex);
    return bucketFromTrades(String(monthIndex), label, bucketTrades, customResults);
  });
}

export type TimeOfDayCalcBy = "start" | "end" | "active";

export interface TimeOfDayOptions {
  windowMinutes: 30 | 60 | 120;
  calculateBy: TimeOfDayCalcBy;
  rangeStartHour?: number; // 0-24
  rangeEndHour?: number; // 0-24
}

function relevantTime(trade: Trade, calculateBy: TimeOfDayCalcBy): Date {
  if (calculateBy === "end" && trade.end_time) return new Date(trade.end_time);
  return new Date(trade.entry_time);
}

export function timeOfDayBuckets(
  trades: Trade[],
  options: TimeOfDayOptions,
  customResults?: CustomResult[],
): VariableBucketStats[] {
  const { windowMinutes, calculateBy } = options;
  const startHour = options.rangeStartHour ?? 0;
  const endHour = options.rangeEndHour ?? 24;
  const bucketsPerHour = 60 / windowMinutes;
  const totalBuckets = Math.round((endHour - startHour) * bucketsPerHour);

  const buckets: VariableBucketStats[] = [];
  for (let i = 0; i < totalBuckets; i++) {
    const bucketStartMinutes = startHour * 60 + i * windowMinutes;
    const h = Math.floor(bucketStartMinutes / 60);
    const m = bucketStartMinutes % 60;
    const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const bucketTrades = trades.filter((t) => {
      if (calculateBy === "active") {
        return trade_spansBucket(t, bucketStartMinutes, windowMinutes);
      }
      const d = relevantTime(t, calculateBy);
      const minutesOfDay = d.getHours() * 60 + d.getMinutes();
      return minutesOfDay >= bucketStartMinutes && minutesOfDay < bucketStartMinutes + windowMinutes;
    });

    buckets.push(bucketFromTrades(String(i), label, bucketTrades, customResults));
  }
  return buckets;
}

function trade_spansBucket(trade: Trade, bucketStartMinutes: number, windowMinutes: number): boolean {
  const start = new Date(trade.entry_time);
  const end = trade.end_time ? new Date(trade.end_time) : start;
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const bucketEnd = bucketStartMinutes + windowMinutes;
  return startMin < bucketEnd && endMin >= bucketStartMinutes;
}

export interface NumberVariablePoint {
  tradeId: string;
  value: number;
  resultR: number;
}

export function numberVariableSeries(trades: Trade[], variableId: string): NumberVariablePoint[] {
  return trades
    .filter((t) => t.variableValues?.[variableId]?.numberValue != null)
    .map((t) => ({
      tradeId: t.id,
      value: t.variableValues![variableId].numberValue!,
      resultR: t.result_r,
    }));
}
