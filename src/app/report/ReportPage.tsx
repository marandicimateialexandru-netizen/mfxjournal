import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SymbolFilterCombobox } from "@/components/shared/SymbolFilterCombobox";
import { formatR, formatPct } from "@/lib/format";
import { useStats } from "@/features/stats/useStats";
import { computeStats } from "@/features/stats/computeStats";
import { dayOfWeekBuckets, timeOfDayBuckets, streakBuckets } from "@/features/stats/pseudoVariables";
import { detectPatterns } from "@/features/patterns/detectedPatterns";
import { TradeVariableCalculator } from "@/features/report/TradeVariableCalculator";
import { useUiStore, type DateRangePreset } from "@/store/uiStore";
import { useStreakThresholds } from "@/features/variables/useAuxLists";
import { cn } from "@/lib/utils";
import type { VariableBucketStats } from "@/features/stats/types";

const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "last7", label: "Last 7 Days" },
  { id: "last30", label: "Last 30 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "thisYear", label: "This Year" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEK_ORDER = [1, 2, 3, 4, 5];

/** A document heading, not a card header — a large faint numeral instead of an icon badge, a thin
 *  rule instead of a box border. The whole point of this redesign is to NOT look like another row
 *  of Dashboard widgets; a report reads as a document, not a grid of glanceable cards. */
function SectionHeader({ index, title, subtitle }: { index: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-[var(--color-border)] pb-3">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-black leading-none tabular-nums text-[#8b5cf6]/20">{index}</span>
        <div>
          <h2 className="text-base font-bold leading-tight tracking-tight text-[var(--color-text)]">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

/** One segment of a ticker band — several of these sit side by side, divided by hairlines, instead
 *  of each metric getting its own bordered/shadowed card. Reads like a financial statement's
 *  summary row rather than a dashboard stat-tile grid. */
function Ticker({ label, value, tone = "neutral", size = "lg" }: { label: string; value: string; tone?: "pos" | "neg" | "neutral"; size?: "lg" | "sm" }) {
  const color =
    tone === "pos" ? "text-[var(--color-success)]" : tone === "neg" ? "text-[var(--color-danger)]" : "text-[var(--color-text)]";
  return (
    <div className="min-w-[110px] flex-1 px-4 py-3 first:pl-0 last:pr-0">
      <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">{label}</div>
      <div className={cn("mt-1 truncate font-extrabold tabular-nums", size === "lg" ? "text-2xl" : "text-base", color)}>{value}</div>
    </div>
  );
}

function TickerBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap divide-x divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      {children}
    </div>
  );
}

/** A diverging return bar, anchored at a center zero-line — the classic "monthly returns" visual
 *  from a real fund tearsheet, and something genuinely different from anything else in this app
 *  (nothing here is a card or a stacked win/BE bar). Bar length is relative to the largest |R| in
 *  the same table, so a table full of small numbers doesn't render as a wall of barely-visible slivers. */
function DivergingRow({ label, sub, totalR, maxAbs, fmt }: { label: string; sub: string; totalR: number; maxAbs: number; fmt: (r: number) => string }) {
  const positive = totalR >= 0;
  const pct = maxAbs > 0 ? Math.min(100, (Math.abs(totalR) / maxAbs) * 100) : 0;
  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-border)] py-2.5 last:border-0">
      <div className="w-20 shrink-0 sm:w-24">
        <div className="truncate text-sm font-semibold text-[var(--color-text)]">{label}</div>
        <div className="truncate text-[11px] text-[var(--color-text-muted)]">{sub}</div>
      </div>
      <div className="relative h-5 flex-1">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--color-border)]" />
        <div
          className={cn("absolute top-1 h-3 rounded-sm", positive ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]")}
          style={positive ? { left: "50%", width: `${pct / 2}%` } : { right: "50%", width: `${pct / 2}%` }}
        />
      </div>
      <div className={cn("w-20 shrink-0 text-right text-sm font-bold tabular-nums", positive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
        {fmt(totalR)}
      </div>
    </div>
  );
}

/** A 7-cell heat strip — background intensity (not a card, not a bar) carries the signal, the same
 *  "glance at the color, not the number" language a real trading-calendar heatmap uses. */
function DayHeatCell({ label, bucket }: { label: string; bucket: VariableBucketStats }) {
  const has = bucket.tradeCount > 0;
  const intensity = has ? Math.max(-1, Math.min(1, (bucket.winRatePct - 50) / 50)) : 0;
  const bg = has
    ? intensity >= 0
      ? `color-mix(in srgb, var(--color-success) ${Math.round(intensity * 40)}%, var(--color-background))`
      : `color-mix(in srgb, var(--color-danger) ${Math.round(-intensity * 40)}%, var(--color-background))`
    : "var(--color-background)";
  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-[var(--color-border)] py-5"
      style={{ background: bg }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className={cn("text-lg font-extrabold tabular-nums", has ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]")}>
        {has ? formatPct(bucket.winRatePct) : "—"}
      </div>
      <div className="text-[10px] tabular-nums text-[var(--color-text-muted)]">{bucket.tradeCount}×</div>
    </div>
  );
}

/** A 24-hour activity strip styled like a row of candlesticks — bar height is trade volume, bar
 *  color is that hour's win rate. Hovering pops the candle up with a glow and drops a detail card
 *  above it, so the strip stays a single "shape across the day" glance until you actually want the
 *  numbers behind one hour. */
function HourStrip({ buckets, fmt }: { buckets: VariableBucketStats[]; fmt: (r: number) => string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxTrades = Math.max(1, ...buckets.map((b) => b.tradeCount));
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px] overflow-visible rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 pt-12">
        {buckets.map((b, i) => {
          const has = b.tradeCount > 0;
          const heightPct = has ? Math.max(6, (b.tradeCount / maxTrades) * 100) : 3;
          const isWin = b.winRatePct >= 50;
          const color = has ? (isWin ? "var(--color-success)" : "var(--color-danger)") : "var(--color-border)";
          const isHovered = hovered === i;
          return (
            <div
              key={b.valueId}
              className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => has && setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={cn(
                  "pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 shadow-lg transition-all duration-150 ease-out",
                  isHovered ? "scale-100 opacity-100" : "scale-90 opacity-0",
                )}
              >
                <div className="text-[11px] font-bold text-[var(--color-text)]">{b.label}</div>
                <div className="mt-0.5 whitespace-nowrap text-[10px] text-[var(--color-text-muted)]">
                  {b.tradeCount} trades · <span className={isWin ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>{formatPct(b.winRatePct)} WR</span>
                </div>
                <div className={cn("mt-0.5 text-xs font-bold tabular-nums", b.totalR >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>{fmt(b.totalR)}</div>
              </div>
              {/* wick */}
              <div
                className="absolute bottom-0 w-px transition-all duration-150 ease-out"
                style={{ height: has ? `${Math.min(100, heightPct + 8)}%` : "0%", background: color, opacity: has ? 0.5 : 0 }}
              />
              <div
                className="relative w-full origin-bottom rounded-t-[3px] transition-all duration-150 ease-out"
                style={{
                  height: `${heightPct}%`,
                  background: `linear-gradient(to top, color-mix(in srgb, ${color} 55%, transparent), ${color})`,
                  opacity: has ? (isHovered ? 1 : 0.82) : 0.3,
                  transform: isHovered ? "scaleX(1.25) translateY(-2px)" : "scaleX(1) translateY(0)",
                  boxShadow: isHovered && has ? `0 0 12px color-mix(in srgb, ${color} 65%, transparent)` : "none",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between px-4 text-[10px] tabular-nums text-[var(--color-text-muted)]">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>
    </div>
  );
}

/** A ranked leaderboard, not a stacked win/BE-rate card — sorted by actual R contributed, so the
 *  value that made or lost you the most money sits at the top, not whatever the configured display
 *  order happens to be. */
function RankedTable({ label, icon, buckets, fmt }: { label: string; icon: string | null; buckets: VariableBucketStats[]; fmt: (r: number) => string }) {
  // Every configured value gets a row — even "0 trades" — the same rule WinRateCard uses. The old
  // version filtered to tradeCount > 0 BEFORE the length check, so a variable nobody had tagged any
  // trades with yet (every value here, not just one) silently vanished instead of showing "0×" rows;
  // that's what made every variable but the one with tagged data disappear from this section. The
  // card itself only hides when the variable has no configured values at all.
  const ranked = useMemo(() => [...buckets].sort((a, b) => b.totalR - a.totalR), [buckets]);
  if (ranked.length === 0) return null;
  const maxAbsR = Math.max(1, ...ranked.map((b) => Math.abs(b.totalR)));
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] transition-shadow hover:shadow-lg hover:shadow-black/5">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-text)]">{label}</span>
      </div>
      <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-3 py-1">
        <span className="w-4 shrink-0" />
        <span className="min-w-0 flex-1" />
        <span className="w-12 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Trades</span>
        <span className="w-12 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">WR</span>
        <span className="w-[72px] shrink-0 text-right text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Total R</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {ranked.map((b, i) => {
          const empty = b.tradeCount === 0;
          return (
            <div key={b.valueId} className="relative flex items-center gap-2.5 px-3 py-2 text-sm">
              <div
                className={cn("absolute inset-y-0 left-0 opacity-[0.08]", b.totalR >= 0 ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]")}
                style={{ width: `${(Math.abs(b.totalR) / maxAbsR) * 100}%` }}
              />
              <span className="relative w-4 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-text-muted)]">{i + 1}</span>
              <span className={cn("relative min-w-0 flex-1 truncate", empty ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]")}>{b.icon ? `${b.icon} ` : ""}{b.label}</span>
              <span className="relative w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-text-muted)]">{b.tradeCount}×</span>
              <span className="relative w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-text-muted)]">{empty ? "—" : formatPct(b.winRatePct)}</span>
              <span
                className={cn(
                  "relative w-[72px] shrink-0 text-right text-sm font-bold tabular-nums",
                  empty ? "text-[var(--color-text-muted)]" : b.totalR >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
                )}
              >
                {empty ? "—" : fmt(b.totalR)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const streakEnabled = !!settings?.streak_analysis_enabled && streakThresholds.length > 0;
  const streaks = useMemo(() => {
    if (!streakEnabled) return [];
    return streakBuckets(
      stats.filteredTrades,
      { thresholds: streakThresholds, beBreaksStreak: !!(settings?.streak_be_breaks_streak ?? 1) },
      customResults,
    );
  }, [stats.filteredTrades, customResults, streakEnabled, streakThresholds, settings]);

  const yearly = useMemo(() => {
    const years = [...new Set(stats.filteredTrades.map((t) => new Date(t.entry_time).getFullYear()))].sort();
    return years.map((year) => ({
      key: String(year),
      label: String(year),
      ...computeStats(
        stats.filteredTrades.filter((t) => new Date(t.entry_time).getFullYear() === year),
        { customResults },
      ),
    }));
  }, [stats.filteredTrades, customResults]);
  const yearlyMaxAbs = Math.max(1, ...yearly.map((y) => Math.abs(y.totalR)));

  const monthly = useMemo(() => {
    const keys = [...new Set(stats.filteredTrades.map((t) => format(new Date(t.entry_time), "yyyy-MM")))].sort();
    return keys.map((key) => ({
      key,
      label: format(new Date(key + "-01"), "MMM yyyy"),
      ...computeStats(
        stats.filteredTrades.filter((t) => format(new Date(t.entry_time), "yyyy-MM") === key),
        { customResults },
      ),
    }));
  }, [stats.filteredTrades, customResults]);
  const monthlyMaxAbs = Math.max(1, ...monthly.map((m) => Math.abs(m.totalR)));

  const bestMonth = monthly.length > 0 ? [...monthly].sort((a, b) => b.totalR - a.totalR)[0] : null;
  const worstMonth = monthly.length > 0 ? [...monthly].sort((a, b) => a.totalR - b.totalR)[0] : null;

  const patterns = useMemo(() => detectPatterns(stats, trades, variables, customResults), [stats, trades, variables, customResults]);

  const recent7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return computeStats(stats.filteredTrades.filter((t) => new Date(t.entry_time).getTime() >= cutoff), { customResults });
  }, [stats.filteredTrades, customResults]);
  const recent30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return computeStats(stats.filteredTrades.filter((t) => new Date(t.entry_time).getTime() >= cutoff), { customResults });
  }, [stats.filteredTrades, customResults]);

  const avgTradesPerMonth = monthly.length > 0 ? stats.totalTrades / monthly.length : stats.totalTrades;
  const textVariables = variables.filter((v) => v.type === "text");

  return (
    <div className="space-y-10 p-6 print:p-0">
      <div className="flex items-end justify-between gap-4 border-b border-[var(--color-border)] pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-text)]">Trader Report</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {stats.totalTrades} trades · {DATE_PRESETS.find((p) => p.id === dateRange.preset)?.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SymbolFilterCombobox />
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

      <section>
        <SectionHeader index="01" title="Core Performance" subtitle="The headline figures for this period" />
        <TickerBand>
          <Ticker label="Total Trades" value={String(stats.totalTrades)} />
          <Ticker label="Win Rate" value={formatPct(stats.winRatePct)} />
          <Ticker label="Expectancy" value={fmt(stats.expectancyR)} tone={stats.expectancyR >= 0 ? "pos" : "neg"} />
          <Ticker label="Total R Gained" value={fmt(stats.totalR)} tone={stats.totalR >= 0 ? "pos" : "neg"} />
          <Ticker label="Profit Factor" value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} />
          <Ticker label="Max Drawdown" value={fmt(-stats.maxDrawdownR)} tone="neg" />
        </TickerBand>
        <div className="mt-2">
          <TickerBand>
            <Ticker size="sm" label="BE Rate" value={formatPct(stats.beRatePct)} />
            <Ticker size="sm" label="Recovery Factor" value={Number.isFinite(stats.recoveryFactor) ? stats.recoveryFactor.toFixed(2) : "∞"} />
            <Ticker size="sm" label="Max Win Streak" value={String(stats.maxWinStreak)} tone="pos" />
            <Ticker size="sm" label="Max Loss Streak" value={String(stats.maxLossStreak)} tone="neg" />
            <Ticker size="sm" label="Avg R / Trade" value={fmt(stats.avgR)} tone={stats.avgR >= 0 ? "pos" : "neg"} />
            <Ticker size="sm" label="Avg Trades / Mo" value={avgTradesPerMonth.toFixed(1)} />
          </TickerBand>
        </div>
      </section>

      <section>
        <SectionHeader index="02" title="Recent Activity" subtitle="A quick pulse check before the full breakdown" />
        <TickerBand>
          <Ticker label="Last 7 Days" value={fmt(recent7.totalR)} tone={recent7.totalR >= 0 ? "pos" : "neg"} />
          <Ticker size="sm" label="7d Win Rate" value={formatPct(recent7.winRatePct)} />
          <Ticker label="Last 30 Days" value={fmt(recent30.totalR)} tone={recent30.totalR >= 0 ? "pos" : "neg"} />
          <Ticker size="sm" label="30d Win Rate" value={formatPct(recent30.winRatePct)} />
          <Ticker
            label="Current Streak"
            value={stats.currentStreak.type === "none" ? "—" : `${stats.currentStreak.count} ${stats.currentStreak.type}`}
            tone={stats.currentStreak.type === "win" ? "pos" : stats.currentStreak.type === "loss" ? "neg" : "neutral"}
          />
        </TickerBand>
      </section>

      {streakEnabled && (
        <section>
          <SectionHeader index="03" title="Streak Context" subtitle="How you trade right after a win or loss streak" />
          <RankedTable label="After a streak" icon={null} buckets={streaks} fmt={fmt} />
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Configure thresholds on the Variables page.</p>
        </section>
      )}

      <section>
        <SectionHeader index="04" title="Yearly Returns" subtitle={`${yearly.length} year${yearly.length === 1 ? "" : "s"} of trading history`} />
        <div className="rounded-lg border border-[var(--color-border)] px-4">
          {yearly.map((y) => (
            <DivergingRow key={y.key} label={y.label} sub={`${y.totalTrades} trades · ${formatPct(y.winRatePct)} WR`} totalR={y.totalR} maxAbs={yearlyMaxAbs} fmt={fmt} />
          ))}
          {yearly.length === 0 && <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No trades in this period.</p>}
        </div>
      </section>

      <section>
        <SectionHeader
          index="05"
          title="Monthly Returns"
          subtitle={bestMonth && worstMonth ? `Best: ${bestMonth.label} (${fmt(bestMonth.totalR)}) · Worst: ${worstMonth.label} (${fmt(worstMonth.totalR)})` : "Month-by-month breakdown"}
        />
        <div className="rounded-lg border border-[var(--color-border)] px-4">
          {monthly.map((m) => (
            <DivergingRow key={m.key} label={m.label} sub={`${m.totalTrades} trades · ${formatPct(m.winRatePct)} WR`} totalR={m.totalR} maxAbs={monthlyMaxAbs} fmt={fmt} />
          ))}
          {monthly.length === 0 && <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No trades in this period.</p>}
        </div>
      </section>

      <section>
        <SectionHeader index="06" title="Day of Week" subtitle="Win rate by day, color-coded — darker means stronger" />
        <div className="flex gap-2">
          {WEEK_ORDER.map((dayIndex, i) => (
            <DayHeatCell key={dayIndex} label={WEEKDAY_LABELS[i]} bucket={dow[dayIndex]} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader index="07" title="Time of Day" subtitle="Trade volume across the day — hover an hour for the breakdown" />
        <HourStrip buckets={tod} fmt={fmt} />
      </section>

      <section>
        <SectionHeader index="08" title="Variable Performance" subtitle={`${textVariables.length} variable type${textVariables.length === 1 ? "" : "s"}, ranked by total R`} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {textVariables.map((v) => (
            <RankedTable key={v.id} label={v.label} icon={v.icon} buckets={stats.byVariable[v.id] ?? []} fmt={fmt} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader index="09" title="Detected Patterns" subtitle="Deterministic pattern detection across your history" />
        <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {patterns.map((p, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-1 w-5 shrink-0 text-xs font-bold tabular-nums text-[var(--color-text-muted)]">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-sm text-[var(--color-text)]">{p.text}</p>
            </div>
          ))}
          {patterns.length === 0 && <p className="p-6 text-center text-sm text-[var(--color-text-muted)]">Not enough data yet.</p>}
        </div>
      </section>

      <section>
        <SectionHeader index="10" title="Trade Variable Calculator" subtitle="Build any combination of tagged values and see the real win rate for exactly that slice" />
        <TradeVariableCalculator baseTrades={stats.filteredTrades} variables={variables} customResults={customResults} />
      </section>
    </div>
  );
}
