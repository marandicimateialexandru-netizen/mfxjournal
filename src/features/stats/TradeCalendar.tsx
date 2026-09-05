import { Fragment, useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getISOWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, ChevronUp, CalendarDays, Calendar, MousePointerClick } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Trade } from "@/db/types";

interface Selection {
  label: string;
  trades: Trade[];
}

export function TradeCalendar({ trades, onSelectDay }: { trades: Trade[]; onSelectDay?: (day: Date, trades: Trade[]) => void }) {
  const [cursor, setCursor] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [days]);

  const tradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of trades) {
      const key = format(new Date(t.entry_time), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [trades]);

  const monthTrades = useMemo(
    () => trades.filter((t) => isSameMonth(new Date(t.entry_time), cursor)),
    [trades, cursor],
  );
  const monthTotalR = monthTrades.reduce((sum, t) => sum + t.result_r, 0);

  function selectDay(day: Date, dayTrades: Trade[]) {
    if (dayTrades.length === 0) return;
    setSelection({ label: format(day, "EEEE, MMM d"), trades: dayTrades });
    onSelectDay?.(day, dayTrades);
  }

  function selectWeek(weekNum: number, weekTrades: Trade[]) {
    if (weekTrades.length === 0) return;
    setSelection({ label: `Week ${weekNum}`, trades: weekTrades });
  }

  const selTotalR = selection?.trades.reduce((s, t) => s + t.result_r, 0) ?? 0;
  const selWins = selection?.trades.filter((t) => t.outcome === "win").length ?? 0;
  const selLosses = selection?.trades.filter((t) => t.outcome === "loss").length ?? 0;

  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] p-4">
        <CalendarDays className="h-4 w-4 text-[var(--color-primary)]" />
        <h3 className="text-base font-bold text-[var(--color-text)]">Trade Calendar</h3>
        <div className="h-px flex-1 bg-[var(--color-border)]" />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ChevronUp className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {!collapsed && (
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold text-[var(--color-text)]">{format(cursor, "MMMM yyyy")}</span>
            <Calendar className="h-4 w-4 text-[var(--color-text-muted)]" />
            <span className="text-sm text-[var(--color-text-muted)]">{monthTrades.length} trades</span>
            {monthTrades.length > 0 && (
              <Badge variant={monthTotalR >= 0 ? "win" : "loss"} className="font-bold">
                {monthTotalR >= 0 ? "+" : ""}
                {monthTotalR.toFixed(2)}R
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => setCursor(new Date())}
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Today
              </button>
              <Button size="icon" variant="ghost" onClick={() => setCursor((c) => subMonths(c, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setCursor((c) => addMonths(c, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex-1">
              <div className="grid grid-cols-6 gap-2 text-center text-xs font-medium text-[var(--color-text-muted)]">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Week"].map((d) => (
                  <div key={d} className="pb-1">
                    {d}
                  </div>
                ))}

                {weeks.map((week, wi) => {
                  const weekdays = week.slice(0, 5);
                  const weekTrades = week.flatMap((d) => tradesByDay.get(format(d, "yyyy-MM-dd")) ?? []);
                  const weekTotalR = weekTrades.reduce((sum, t) => sum + t.result_r, 0);
                  const wins = weekTrades.filter((t) => t.outcome === "win").length;
                  const losses = weekTrades.filter((t) => t.outcome === "loss").length;
                  const weekNum = getISOWeek(week[0]);

                  return (
                    <Fragment key={`week-row-${wi}`}>
                      {weekdays.map((day) => {
                        const key = format(day, "yyyy-MM-dd");
                        const dayTrades = tradesByDay.get(key) ?? [];
                        const totalR = dayTrades.reduce((sum, t) => sum + t.result_r, 0);
                        const inMonth = isSameMonth(day, cursor);
                        const isToday = isSameDay(day, new Date());
                        const hasTrades = dayTrades.length > 0;
                        const tone = totalR > 0 ? "positive" : totalR < 0 ? "negative" : hasTrades ? "warning" : "none";

                        return (
                          <button
                            key={key}
                            disabled={!hasTrades}
                            onClick={() => selectDay(day, dayTrades)}
                            className={cn(
                              "flex min-h-[92px] flex-col items-start justify-start rounded-lg p-2 text-left transition-colors",
                              !inMonth && "opacity-25",
                              isToday && "ring-2 ring-[var(--color-primary)]",
                              tone === "none" && "bg-white/[0.02]",
                              tone === "positive" && "bg-[#10b981]/25 hover:bg-[#10b981]/35",
                              tone === "negative" && "bg-[#ef4444]/25 hover:bg-[#ef4444]/35",
                              tone === "warning" && "bg-[var(--color-warning)]/25 hover:bg-[var(--color-warning)]/35",
                            )}
                          >
                            <span
                              className={cn(
                                "text-xs",
                                hasTrades ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            {hasTrades && (
                              <div className="mt-auto w-full">
                                <div
                                  className={cn(
                                    "text-base font-extrabold tabular-nums",
                                    tone === "positive" && "text-[#6ee7b7]",
                                    tone === "negative" && "text-[#fca5a5]",
                                    tone === "warning" && "text-[var(--color-warning)]",
                                  )}
                                >
                                  {totalR > 0 ? "+" : ""}
                                  {totalR.toFixed(2)}R
                                </div>
                                <div className="text-[10px] text-[var(--color-text-muted)]">
                                  {dayTrades.length} trade{dayTrades.length === 1 ? "" : "s"}
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => selectWeek(weekNum, weekTrades)}
                        disabled={weekTrades.length === 0}
                        className={cn(
                          "flex min-h-[92px] flex-col items-center justify-center gap-0.5 rounded-lg p-2",
                          weekTrades.length > 0 ? "bg-white/[0.04] hover:bg-white/[0.07]" : "bg-white/[0.015]",
                        )}
                      >
                        <span className="text-[10px] text-[var(--color-text-muted)]">W{weekNum}</span>
                        {weekTrades.length > 0 ? (
                          <>
                            <span
                              className={cn(
                                "text-base font-extrabold tabular-nums",
                                weekTotalR >= 0 ? "text-[#6ee7b7]" : "text-[#fca5a5]",
                              )}
                            >
                              {weekTotalR > 0 ? "+" : ""}
                              {weekTotalR.toFixed(2)}R
                            </span>
                            <span className="text-[10px] tabular-nums">
                              <span className="text-[var(--color-success)]">{wins}W</span>{" "}
                              <span className="text-[var(--color-danger)]">{losses}L</span>
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-[var(--color-text-muted)]">—</span>
                        )}
                      </button>
                    </Fragment>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-center gap-5 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-success)]" /> Profit
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-danger)]" /> Loss
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-warning)]" /> BE
                </span>
              </div>
            </div>

            <div className="w-full shrink-0 border-t border-[var(--color-border)] pt-4 lg:w-64 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h4 className="mb-4 text-sm font-bold text-[var(--color-text)]">Select a Day or Week</h4>
              {!selection ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/70">
                    <MousePointerClick className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">Click on a day or week to see details</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--color-text)]">{selection.label}</span>
                    <Badge variant={selTotalR >= 0 ? "win" : "loss"}>
                      {selTotalR >= 0 ? "+" : ""}
                      {selTotalR.toFixed(2)}R
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-[var(--color-text-muted)]">{selection.trades.length} trades</span>
                    <span className="text-[var(--color-success)]">{selWins}W</span>
                    <span className="text-[var(--color-danger)]">{selLosses}L</span>
                  </div>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {selection.trades.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-md bg-[var(--color-background)] px-2 py-1.5 text-xs"
                      >
                        <span className="text-[var(--color-text-muted)]">{t.market ?? "—"}</span>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            t.result_r > 0
                              ? "text-[var(--color-success)]"
                              : t.result_r < 0
                                ? "text-[var(--color-danger)]"
                                : "text-[var(--color-warning)]",
                          )}
                        >
                          {t.result_r > 0 ? "+" : ""}
                          {t.result_r.toFixed(2)}R
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
