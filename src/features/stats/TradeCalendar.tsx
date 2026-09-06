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
import { IconBadge } from "@/components/shared/IconBadge";
import { TradeDetailModal } from "@/features/trades/TradeDetailModal";
import { cn } from "@/lib/utils";
import type { Trade } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

interface Selection {
  label: string;
  trades: Trade[];
}

type CellTone = "positive" | "negative" | "warning" | "none";

const TONE_VAR: Record<Exclude<CellTone, "none">, string> = {
  positive: "--color-success",
  negative: "--color-danger",
  warning: "--color-warning",
};

/** A solid, richly-saturated fill derived from the theme token (not a translucent overlay),
 *  so it stays correct if the user picks a custom theme. */
function toneBackground(tone: CellTone, pct: number): string | undefined {
  if (tone === "none") return undefined;
  return `color-mix(in srgb, var(${TONE_VAR[tone]}) ${pct}%, var(--color-background))`;
}

export function TradeCalendar({
  trades,
  variables = [],
  onSelectDay,
}: {
  trades: Trade[];
  variables?: VariableWithValues[];
  onSelectDay?: (day: Date, trades: Trade[]) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);

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
        <IconBadge icon={CalendarDays} tone="violet" size={30} />
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
            <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <Calendar className="h-3.5 w-3.5" />
              {monthTrades.length} trades
            </span>
            {monthTrades.length > 0 && (
              <Badge variant={monthTotalR >= 0 ? "win" : "loss"} className="font-bold">
                {monthTotalR >= 0 ? "+" : ""}
                {monthTotalR.toFixed(2)}R
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setCursor(new Date())}
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
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
              <div className="grid grid-cols-6 gap-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Week"].map((d) => (
                  <div key={d} className="pb-2">
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
                            style={{ background: toneBackground(tone, 16) }}
                            className={cn(
                              "flex min-h-[128px] flex-col items-start justify-between gap-1 rounded-xl border p-3 text-left transition-all duration-150",
                              !inMonth && "opacity-25",
                              isToday && "ring-2 ring-[var(--color-primary)] ring-offset-1 ring-offset-[var(--color-surface)]",
                              tone === "none" && "border-white/[0.04] bg-white/[0.015]",
                              tone !== "none" && "border-transparent shadow-sm hover:-translate-y-0.5",
                              tone === "positive" &&
                                "hover:shadow-[0_2px_8px_rgba(0,0,0,0.15),0_0_0_1.5px_color-mix(in_srgb,#34d399_60%,transparent)]",
                              tone === "negative" &&
                                "hover:shadow-[0_2px_8px_rgba(0,0,0,0.15),0_0_0_1.5px_color-mix(in_srgb,var(--color-danger)_60%,transparent)]",
                              tone === "warning" &&
                                "hover:shadow-[0_2px_8px_rgba(0,0,0,0.15),0_0_0_1.5px_color-mix(in_srgb,var(--color-warning)_60%,transparent)]",
                            )}
                          >
                            <span
                              className={cn(
                                "text-sm font-medium",
                                hasTrades ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            {hasTrades && (
                              <div
                                style={{ background: toneBackground(tone, 42) }}
                                className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-center"
                              >
                                <div
                                  className={cn(
                                    "text-lg font-extrabold tabular-nums",
                                    tone === "positive" && "text-[#34d399]",
                                    tone === "negative" && "text-[#fca5a5]",
                                    tone === "warning" && "text-[var(--color-warning)]",
                                  )}
                                >
                                  {totalR > 0 ? "+" : ""}
                                  {totalR.toFixed(2)}R
                                </div>
                                <div className="text-xs text-[var(--color-text-muted)]">
                                  {dayTrades.length} trade{dayTrades.length === 1 ? "" : "s"}
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {(() => {
                        const weekTone =
                          weekTotalR > 0 ? "positive" : weekTotalR < 0 ? "negative" : weekTrades.length > 0 ? "warning" : "none";
                        return (
                          <button
                            onClick={() => selectWeek(weekNum, weekTrades)}
                            disabled={weekTrades.length === 0}
                            style={{ background: toneBackground(weekTone, 16) }}
                            className={cn(
                              "flex min-h-[128px] flex-col items-center justify-between gap-1 rounded-xl border p-3 transition-all duration-150",
                              weekTone === "none" && "border-white/[0.04] bg-white/[0.015]",
                              weekTone !== "none" && "border-transparent shadow-sm hover:-translate-y-0.5",
                              weekTone === "positive" &&
                                "hover:shadow-[0_2px_8px_rgba(0,0,0,0.15),0_0_0_1.5px_color-mix(in_srgb,#34d399_60%,transparent)]",
                              weekTone === "negative" &&
                                "hover:shadow-[0_2px_8px_rgba(0,0,0,0.15),0_0_0_1.5px_color-mix(in_srgb,var(--color-danger)_60%,transparent)]",
                              weekTone === "warning" &&
                                "hover:shadow-[0_2px_8px_rgba(0,0,0,0.15),0_0_0_1.5px_color-mix(in_srgb,var(--color-warning)_60%,transparent)]",
                            )}
                          >
                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                              Week {weekNum}
                            </span>
                            {weekTrades.length > 0 && (
                              <div
                                style={{ background: toneBackground(weekTone, 42) }}
                                className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg py-1.5"
                              >
                                <span
                                  className={cn(
                                    "text-lg font-extrabold tabular-nums",
                                    weekTone === "positive" && "text-[#34d399]",
                                    weekTone === "negative" && "text-[#fca5a5]",
                                    weekTone === "warning" && "text-[var(--color-warning)]",
                                  )}
                                >
                                  {weekTotalR > 0 ? "+" : ""}
                                  {weekTotalR.toFixed(2)}R
                                </span>
                                <span className="text-xs tabular-nums">
                                  <span className="text-[var(--color-success)]">{wins}W</span>{" "}
                                  <span className="text-[var(--color-danger)]">{losses}L</span>
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })()}
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
                      <button
                        key={t.id}
                        onClick={() => setActiveTrade(t)}
                        className="group flex w-full items-center justify-between rounded-md bg-[var(--color-background)] px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-primary)]/20"
                      >
                        <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">
                          {t.market ?? "—"}
                        </span>
                        <span className="flex items-center gap-1">
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
                          <ChevronRight className="h-3 w-3 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}

      <TradeDetailModal
        trade={activeTrade}
        trades={selection?.trades ?? []}
        variables={variables}
        onClose={() => setActiveTrade(null)}
        onNavigate={setActiveTrade}
      />
    </Card>
  );
}
