import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Printer } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatR, formatPct } from "@/lib/format";
import { useStats } from "@/features/stats/useStats";
import { computeStats } from "@/features/stats/computeStats";
import { dayOfWeekBuckets, timeOfDayBuckets } from "@/features/stats/pseudoVariables";
import { detectPatterns } from "@/features/patterns/detectedPatterns";
import { useUiStore, type DateRangePreset } from "@/store/uiStore";
import type { StreakThreshold } from "@/db/types";
import { useStreakThresholds } from "@/features/variables/useAuxLists";

const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "last7", label: "Last 7 Days" },
  { id: "last30", label: "Last 30 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "thisYear", label: "This Year" },
];

function CollapsibleSection({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <button className="flex w-full items-center justify-between p-4" onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-2 text-sm font-medium">
          {title} {badge && <span className="rounded-full bg-[var(--color-background)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">{badge}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function computeStreakContext(
  trades: ReturnType<typeof useStats>["stats"]["filteredTrades"],
  threshold: number,
  customResults: ReturnType<typeof useStats>["customResults"],
) {
  const sorted = [...trades].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime());
  const afterWinStreak: typeof trades = [];
  const afterLossStreak: typeof trades = [];
  let winRun = 0;
  let lossRun = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (winRun >= threshold) afterWinStreak.push(sorted[i]);
    if (lossRun >= threshold) afterLossStreak.push(sorted[i]);
    if (sorted[i].outcome === "win") {
      winRun += 1;
      lossRun = 0;
    } else if (sorted[i].outcome === "loss") {
      lossRun += 1;
      winRun = 0;
    } else {
      winRun = 0;
      lossRun = 0;
    }
  }
  return {
    afterWin: computeStats(afterWinStreak, { customResults }),
    afterLoss: computeStats(afterLossStreak, { customResults }),
  };
}

export default function ReportPage() {
  const { stats, trades, variables, customResults, settings } = useStats();
  const { data: streakThresholds = [] } = useStreakThresholds();
  const dateRange = useUiStore((s) => s.dateRange);
  const setDateRange = useUiStore((s) => s.setDateRange);
  const calcMode = settings?.calc_mode ?? "r";
  const fmt = (r: number) => formatR(r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true });

  const dow = useMemo(() => dayOfWeekBuckets(stats.filteredTrades, customResults), [stats.filteredTrades, customResults]);
  const tod = useMemo(
    () => timeOfDayBuckets(stats.filteredTrades, { windowMinutes: 60, calculateBy: "start" }, customResults),
    [stats.filteredTrades, customResults],
  );

  const yearly = useMemo(() => {
    const years = [...new Set(stats.filteredTrades.map((t) => new Date(t.entry_time).getFullYear()))].sort();
    return years.map((year) => {
      const yearTrades = stats.filteredTrades.filter((t) => new Date(t.entry_time).getFullYear() === year);
      return { year, ...computeStats(yearTrades, { customResults }) };
    });
  }, [stats.filteredTrades, customResults]);

  const monthly = useMemo(() => {
    const keys = [...new Set(stats.filteredTrades.map((t) => format(new Date(t.entry_time), "yyyy-MM")))].sort();
    return keys.map((key) => {
      const monthTrades = stats.filteredTrades.filter((t) => format(new Date(t.entry_time), "yyyy-MM") === key);
      return { key, label: format(new Date(key + "-01"), "MMM yyyy"), ...computeStats(monthTrades, { customResults }) };
    });
  }, [stats.filteredTrades, customResults]);

  const bestMonth = monthly.length > 0 ? [...monthly].sort((a, b) => b.totalR - a.totalR)[0] : null;
  const worstMonth = monthly.length > 0 ? [...monthly].sort((a, b) => a.totalR - b.totalR)[0] : null;

  const patterns = useMemo(() => detectPatterns(stats, trades, variables), [stats, trades, variables]);

  const recent7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return computeStats(stats.filteredTrades.filter((t) => new Date(t.entry_time).getTime() >= cutoff), { customResults });
  }, [stats.filteredTrades, customResults]);
  const recent30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return computeStats(stats.filteredTrades.filter((t) => new Date(t.entry_time).getTime() >= cutoff), { customResults });
  }, [stats.filteredTrades, customResults]);

  const avgTradesPerMonth = monthly.length > 0 ? stats.totalTrades / monthly.length : stats.totalTrades;

  const coreMetrics: [string, string][] = [
    ["Total Trades", String(stats.totalTrades)],
    ["Win Rate", formatPct(stats.winRatePct)],
    ["BE Rate", formatPct(stats.beRatePct)],
    ["Expectancy", fmt(stats.expectancyR)],
    ["Total R Gained", fmt(stats.totalR)],
    ["Profit Factor", Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"],
    ["Max Drawdown", `${fmt(-stats.maxDrawdownR)} (${stats.maxDrawdownTradeCount} trades)`],
    ["Recovery Factor", Number.isFinite(stats.recoveryFactor) ? stats.recoveryFactor.toFixed(2) : "∞"],
    ["Max Win Streak", String(stats.maxWinStreak)],
    ["Max Loss Streak", String(stats.maxLossStreak)],
    ["Avg R / Trade", fmt(stats.avgR)],
    ["Avg Trades / Month", avgTradesPerMonth.toFixed(1)],
  ];

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold">Trader Report</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {stats.totalTrades} trades · {DATE_PRESETS.find((p) => p.id === dateRange.preset)?.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange.preset} onValueChange={(v) => setDateRange({ preset: v as DateRangePreset, start: null, end: null })}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {coreMetrics.map(([label, value]) => (
            <div key={label} className="rounded-md border border-[var(--color-border)] p-2.5">
              <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
              <div className="text-sm font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {recent7.totalTrades} trades · {formatPct(recent7.winRatePct)} WR · {fmt(recent7.totalR)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {recent30.totalTrades} trades · {formatPct(recent30.winRatePct)} WR · {fmt(recent30.totalR)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current Streak</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {stats.currentStreak.type === "none" ? "—" : `${stats.currentStreak.count} ${stats.currentStreak.type}`}
          </CardContent>
        </Card>
      </div>

      <CollapsibleSection title="Streak Analysis">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-muted)]">
              <th className="p-1.5">Context</th>
              <th className="p-1.5">Trades</th>
              <th className="p-1.5">Win Rate</th>
              <th className="p-1.5">Avg R</th>
              <th className="p-1.5">Total R</th>
            </tr>
          </thead>
          <tbody>
            {streakThresholds.map((th: StreakThreshold) => {
              const { afterWin, afterLoss } = computeStreakContext(stats.filteredTrades, th.threshold, customResults);
              return (
                <React.Fragment key={th.id}>
                  <tr className="border-t border-[var(--color-border)]">
                    <td className="p-1.5">After {th.threshold}+ Win Streak</td>
                    <td className="p-1.5">{afterWin.totalTrades}</td>
                    <td className="p-1.5">{formatPct(afterWin.winRatePct)}</td>
                    <td className="p-1.5">{fmt(afterWin.avgR)}</td>
                    <td className="p-1.5">{fmt(afterWin.totalR)}</td>
                  </tr>
                  <tr className="border-t border-[var(--color-border)]">
                    <td className="p-1.5">After {th.threshold}+ Loss Streak</td>
                    <td className="p-1.5">{afterLoss.totalTrades}</td>
                    <td className="p-1.5">{formatPct(afterLoss.winRatePct)}</td>
                    <td className="p-1.5">{fmt(afterLoss.avgR)}</td>
                    <td className="p-1.5">{fmt(afterLoss.totalR)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <p className="pt-2 text-xs text-[var(--color-text-muted)]">Configure thresholds on the Variables page.</p>
      </CollapsibleSection>

      <CollapsibleSection title="Yearly Performance">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-muted)]">
              <th className="p-1.5">Year</th>
              <th className="p-1.5">Trades</th>
              <th className="p-1.5">Win Rate</th>
              <th className="p-1.5">BE Rate</th>
              <th className="p-1.5">Avg R</th>
              <th className="p-1.5">Total R</th>
            </tr>
          </thead>
          <tbody>
            {yearly.map((y) => (
              <tr key={y.year} className="border-t border-[var(--color-border)]">
                <td className="p-1.5">{y.year}</td>
                <td className="p-1.5">{y.totalTrades}</td>
                <td className="p-1.5">{formatPct(y.winRatePct)}</td>
                <td className="p-1.5">{formatPct(y.beRatePct)}</td>
                <td className="p-1.5">{fmt(y.avgR)}</td>
                <td className="p-1.5">{fmt(y.totalR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection title="Monthly Performance">
        {bestMonth && worstMonth && (
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            Best: {bestMonth.label} ({fmt(bestMonth.totalR)}) · Worst: {worstMonth.label} ({fmt(worstMonth.totalR)})
          </p>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-muted)]">
              <th className="p-1.5">Month</th>
              <th className="p-1.5">Trades</th>
              <th className="p-1.5">Win Rate</th>
              <th className="p-1.5">Avg R</th>
              <th className="p-1.5">Total R</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.key} className="border-t border-[var(--color-border)]">
                <td className="p-1.5">{m.label}</td>
                <td className="p-1.5">{m.totalTrades}</td>
                <td className="p-1.5">{formatPct(m.winRatePct)}</td>
                <td className="p-1.5">{fmt(m.avgR)}</td>
                <td className="p-1.5">{fmt(m.totalR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection title="Day of Week Performance">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-muted)]">
              <th className="p-1.5">Day</th>
              <th className="p-1.5">Trades</th>
              <th className="p-1.5">Win Rate</th>
              <th className="p-1.5">BE Rate</th>
              <th className="p-1.5">Avg R</th>
              <th className="p-1.5">Total R</th>
            </tr>
          </thead>
          <tbody>
            {dow.map((d) => (
              <tr key={d.valueId} className="border-t border-[var(--color-border)]">
                <td className="p-1.5">{d.label}</td>
                <td className="p-1.5">{d.tradeCount}</td>
                <td className="p-1.5">{formatPct(d.winRatePct)}</td>
                <td className="p-1.5">{formatPct(d.beRatePct)}</td>
                <td className="p-1.5">{fmt(d.avgR)}</td>
                <td className="p-1.5">{fmt(d.totalR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection title="Time of Day Performance">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-muted)]">
              <th className="p-1.5">Window</th>
              <th className="p-1.5">Trades</th>
              <th className="p-1.5">Win Rate</th>
              <th className="p-1.5">Avg R</th>
            </tr>
          </thead>
          <tbody>
            {tod
              .filter((t) => t.tradeCount > 0)
              .map((t) => (
                <tr key={t.valueId} className="border-t border-[var(--color-border)]">
                  <td className="p-1.5">{t.label}</td>
                  <td className="p-1.5">{t.tradeCount}</td>
                  <td className="p-1.5">{formatPct(t.winRatePct)}</td>
                  <td className="p-1.5">{fmt(t.avgR)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection title="Variable Performance Summary" badge={`${variables.length} variable types`}>
        <div className="space-y-3">
          {variables.filter((v) => v.type === "text").map((v) => {
            const buckets = stats.byVariable[v.id] ?? [];
            const topPerformers = [...buckets].filter((b) => b.tradeCount > 0).sort((a, b) => b.avgR - a.avgR).slice(0, 3);
            const needsImprovement = [...buckets].filter((b) => b.avgR < 0).sort((a, b) => a.avgR - b.avgR).slice(0, 3);
            return (
              <div key={v.id} className="rounded-md border border-[var(--color-border)] p-3">
                <p className="mb-2 text-sm font-medium">
                  {v.icon} {v.label} <span className="text-xs text-[var(--color-text-muted)]">({buckets.length})</span>
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--color-text-muted)]">
                      <th className="p-1">Name</th>
                      <th className="p-1">Trades</th>
                      <th className="p-1">WR</th>
                      <th className="p-1">Avg R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b) => (
                      <tr key={b.valueId} className="border-t border-[var(--color-border)]">
                        <td className="p-1">{b.label}</td>
                        <td className="p-1">{b.tradeCount}</td>
                        <td className="p-1">{formatPct(b.winRatePct)}</td>
                        <td className="p-1">{fmt(b.avgR)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[var(--color-success)]">Top Performers</p>
                    {topPerformers.map((b) => (
                      <p key={b.valueId}>
                        {b.label}: {fmt(b.avgR)}
                      </p>
                    ))}
                  </div>
                  {needsImprovement.length > 0 && (
                    <div>
                      <p className="text-[var(--color-danger)]">Needs Improvement</p>
                      {needsImprovement.map((b) => (
                        <p key={b.valueId}>
                          {b.label}: {fmt(b.avgR)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="AI-Detected Patterns & Insights">
        <div className="space-y-1.5">
          {patterns.map((p, i) => (
            <p key={i} className="text-sm">
              • {p.text}
            </p>
          ))}
          {patterns.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Not enough data yet.</p>}
        </div>
      </CollapsibleSection>
    </div>
  );
}
