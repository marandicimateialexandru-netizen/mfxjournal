import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
} from "date-fns";
import type { DateRange } from "@/store/uiStore";

export function resolveDateRange(range: DateRange): { start: Date; end: Date } | null {
  const now = new Date();
  switch (range.preset) {
    case "last7":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last30":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "thisMonth":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "lastMonth": {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "thisYear":
      return { start: startOfYear(now), end: endOfDay(now) };
    case "custom":
      if (range.start && range.end) return { start: startOfDay(range.start), end: endOfDay(range.end) };
      return null;
    case "all":
    default:
      return null;
  }
}
