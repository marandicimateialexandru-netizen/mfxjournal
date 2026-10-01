import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import {
  Hash,
  TrendingUp,
  Minus,
  Target,
  BarChart3,
  Gauge as GaugeIcon,
  Flame,
  CalendarCheck,
  CalendarRange,
  Activity,
  PieChart as PieChartIcon,
  Sigma,
  SlidersHorizontal,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SymbolFilterCombobox } from "@/components/shared/SymbolFilterCombobox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { StatTile } from "@/components/shared/StatTile";
import { RadialGauge } from "@/components/shared/RadialGauge";
import { ArcGauge } from "@/components/shared/ArcGauge";
import { IconBadge, toneForKey } from "@/components/shared/IconBadge";
import { AccentCard } from "@/components/shared/AccentCard";
import { OutcomeDonut } from "@/components/shared/OutcomeDonut";
import { AppScoreRadar } from "@/components/shared/AppScoreRadar";
import { EquityCurveChart } from "@/components/shared/EquityCurveChart";
import { TradeCalendar } from "@/features/stats/TradeCalendar";
import { VariablesSection } from "@/features/dashboard/VariablesSection";
import { CustomCombinationsSection } from "@/features/dashboard/CustomCombinationsSection";
import { formatR, formatPct } from "@/lib/format";
import { chartTooltipProps } from "@/lib/chartTheme";
import { useStats } from "@/features/stats/useStats";
import { computeStreaks } from "@/features/stats/computeStats";
import { StreakTile } from "@/components/shared/StreakTile";
import { computeAppScore } from "@/features/stats/appScore";
import { numberVariableSeries } from "@/features/stats/pseudoVariables";
import { useUiStore, type DateRangePreset } from "@/store/uiStore";

const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "last7", label: "Last 7 Days" },
  { id: "last30", label: "Last 30 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "thisYear", label: "This Year" },
];

export default function DashboardPage() {
  const { stats, variables, settings } = useStats();
  // Trade Calendar deliberately never narrows to the active symbol filter — it's meant to always
  // show the full picture of when you traded, regardless of which symbol's stats you're inspecting.
  const { stats: unfilteredStats } = useStats({ symbol: undefined });
  const calcMode = settings?.calc_mode ?? "r";
  const dateRange = useUiStore((s) => s.dateRange);
  const setDateRange = useUiStore((s) => s.setDateRange);
  const beInWinRate = useUiStore((s) => s.beInWinRate);
  const toggleBeInWinRate = useUiStore((s) => s.toggleBeInWinRate);
  const hideBeRateColor = useUiStore((s) => s.hideBeRateColor);
  const toggleHideBeRateColor = useUiStore((s) => s.toggleHideBeRateColor);
  const showLossRateColor = useUiStore((s) => s.showLossRateColor);
  const toggleShowLossRateColor = useUiStore((s) => s.toggleShowLossRateColor);

  const fmt = (r: number) => formatR(r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true });

  const appScore = useMemo(() => computeAppScore(stats), [stats]);

  const dayWin = useMemo(() => {
    const beRange = settings?.day_win_be_range ?? 0;
    const byDay = new Map<string, number>();
    for (const t of stats.filteredTrades) {
      const key = format(new Date(t.entry_time), "yyyy-MM-dd");
      byDay.set(key, (byDay.get(key) ?? 0) + t.result_r);
    }
    let wins = 0;
    let losses = 0;
    // Chronological per-day outcome, fed through the same streak algorithm the stats engine uses
    // for trades, so "current day streak" means exactly the same thing as "current trade streak".
    const categories: ("win" | "loss" | "be")[] = [];
    for (const day of [...byDay.keys()].sort()) {
      const totalR = byDay.get(day)!;
      if (totalR > beRange) {
        wins += 1;
        categories.push("win");
      } else if (totalR < -beRange) {
        losses += 1;
        categories.push("loss");
      } else {
        categories.push("be");
      }
    }
    const { currentStreak } = computeStreaks(categories, true);
    return { wins, losses, pct: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0, currentStreak };
  }, [stats.filteredTrades, settings?.day_win_be_range]);


  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of stats.filteredTrades) {
      const key = format(new Date(t.entry_time), "MMM d");
      map.set(key, (map.get(key) ?? 0) + t.result_r);
    }
    return [...map.entries()].map(([date, r]) => ({ date, r }));
  }, [stats.filteredTrades]);

  const monthlyPerformance = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of stats.filteredTrades) {
      const key = format(new Date(t.entry_time), "MMM yyyy");
      map.set(key, (map.get(key) ?? 0) + t.result_r);
    }
    return [...map.entries()].map(([month, r]) => ({ month, r }));
  }, [stats.filteredTrades]);

  const numberVariables = variables.filter((v) => v.type === "number");

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={LayoutDashboard} tone="violet" size={38} />
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">Dashboard</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Your trading performance at a glance</p>
          </div>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold tabular-nums shadow-sm",
            stats.totalR >= 0 ? "bg-[#34d399]/15 text-[#34d399]" : "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          {fmt(stats.totalR)} total · {stats.totalTrades} trade{stats.totalTrades === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-sm">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Toggles
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={beInWinRate} onCheckedChange={toggleBeInWinRate}>
              BE in Win Rate
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={hideBeRateColor} onCheckedChange={toggleHideBeRateColor}>
              Hide breakeven rate color
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showLossRateColor} onCheckedChange={toggleShowLossRateColor}>
              Show loss rate color
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-tour="dashboard-stats">
        <StatTile
          label="Total Trades"
          value={String(stats.totalTrades)}
          icon={Hash}
          iconTone="violet"
          countTo={stats.totalTrades}
          format={(n) => String(Math.round(n))}
        />
        <StatTile
          label="Total R"
          value={fmt(stats.totalR)}
          icon={TrendingUp}
          tone={stats.totalR >= 0 ? "positive" : "negative"}
          countTo={stats.totalR}
          format={fmt}
          countDelay={30}
        />
        <StatTile
          label={`Win Rate${beInWinRate ? "" : " (excl. BE)"}`}
          value={formatPct(stats.winRatePct)}
          icon={Target}
          iconTone="teal"
          info="Wins / (Wins + Losses), breakevens excluded."
          countTo={stats.winRatePct}
          format={(n) => formatPct(n)}
          countDelay={60}
          gauge={<ArcGauge winPct={stats.winRatePct} winLabel={stats.wins} lossLabel={stats.losses} width={80} />}
        />
        <StatTile
          label="BE Rate"
          value={formatPct(stats.beRatePct)}
          icon={Minus}
          iconTone={hideBeRateColor ? "slate" : "amber"}
          tone={hideBeRateColor ? "neutral" : "warning"}
          countTo={stats.beRatePct}
          format={(n) => formatPct(n)}
          countDelay={90}
        />

        <StatTile
          label="Day Win % (excl. BE)"
          value={formatPct(dayWin.pct)}
          icon={CalendarCheck}
          iconTone="violet"
          info="Share of trading days that closed net positive, using the breakeven range set in Settings."
          countTo={dayWin.pct}
          format={(n) => formatPct(n)}
          countDelay={120}
          gauge={<ArcGauge winPct={dayWin.pct} winLabel={dayWin.wins} lossLabel={dayWin.losses} width={80} />}
        />
        <StatTile
          label="Avg R"
          value={fmt(stats.avgR)}
          icon={BarChart3}
          tone={stats.avgR >= 0 ? "positive" : "negative"}
          countTo={stats.avgR}
          format={fmt}
          countDelay={150}
        />
        <StatTile
          label="Profit Factor"
          value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"}
          icon={GaugeIcon}
          iconTone="green"
          info="Sum of winning R divided by the absolute sum of losing R."
          countTo={Number.isFinite(stats.profitFactor) ? stats.profitFactor : undefined}
          format={(n) => n.toFixed(2)}
          countDelay={180}
          gauge={
            <RadialGauge
              value={Math.min(100, (Number.isFinite(stats.profitFactor) ? stats.profitFactor : 3) * (100 / 3))}
              size={48}
              strokeWidth={6}
              gradient={["#34d399", "#059669"]}
              showValue={false}
            />
          }
        />
        <StreakTile
          label="Current Streak"
          icon={Flame}
          iconTone="blue"
          info="Consecutive winning or losing days/trades, most recent first. Breakevens reset the streak."
          days={{ streak: dayWin.currentStreak, wins: dayWin.wins, losses: dayWin.losses }}
          trades={{ streak: stats.currentStreak, wins: stats.wins, losses: stats.losses }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-tour="dashboard-equity">
        <EquityCurveChart equityCurve={stats.equityCurve} totalR={stats.totalR} maxDrawdownR={stats.maxDrawdownR} />

        <AccentCard tone="violet" icon={GaugeIcon} title="App Score" subtitle="Composite performance rating">
          <AppScoreRadar breakdown={appScore} />
        </AccentCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-tour="dashboard-charts">
        <AccentCard tone="teal" icon={PieChartIcon} title="Outcome Distribution" subtitle="Wins · losses · breakevens" contentClassName="h-52 px-4 pb-4">
          <OutcomeDonut wins={stats.wins} losses={stats.losses} bes={stats.breakEvens} total={stats.totalTrades} />
        </AccentCard>

        <AccentCard tone="blue" icon={Activity} title="Net Daily P&L" subtitle="Result per trading day" contentClassName="h-52 px-4 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyPnl}>
              <defs>
                <linearGradient id="dailyGain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <filter id="dailyPnlGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.3" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 8" strokeOpacity={0.35} stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltipProps} cursor={false} />
              {/* isAnimationActive off: this bar also carries a drop-shadow filter, and animating a
                  filtered element's geometry (bars growing from the baseline) is the same expensive
                  per-frame re-rasterize that caused the equity curve's stutter — same fix here. */}
              <Bar dataKey="r" radius={[4, 4, 0, 0]} style={{ filter: "url(#dailyPnlGlow)" }} isAnimationActive={false}>
                {dailyPnl.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.r >= 0 ? "url(#dailyGain)" : "var(--color-danger)"}
                    style={{ color: d.r >= 0 ? "#34d399" : "var(--color-danger)" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AccentCard>

        <AccentCard tone="rose" icon={CalendarRange} title="Monthly Performance" subtitle="Result per calendar month" contentClassName="h-52 px-4 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyPerformance}>
              <defs>
                <linearGradient id="monthlyGain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="monthlyLoss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
                <filter id="monthlyPnlGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.3" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 8" strokeOpacity={0.35} stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltipProps} cursor={false} />
              <Bar dataKey="r" radius={[4, 4, 0, 0]} style={{ filter: "url(#monthlyPnlGlow)" }} isAnimationActive={false}>
                {monthlyPerformance.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.r >= 0 ? "url(#monthlyGain)" : "url(#monthlyLoss)"}
                    style={{ color: d.r >= 0 ? "#6ee7b7" : "#fca5a5" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AccentCard>
      </div>

      <VariablesSection />

      <CustomCombinationsSection />

      {numberVariables.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <IconBadge icon={Sigma} tone="slate" size={26} />
            <h2 className="text-sm font-bold text-[var(--color-text)]">Number Variables</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {numberVariables.map((v) => {
              const points = numberVariableSeries(stats.filteredTrades, v.id);
              const tone = toneForKey(v.id);
              return (
                <AccentCard key={v.id} tone={tone} emoji={v.icon ?? "🔢"} title={`${v.label} vs Result R`} contentClassName="h-48 px-4 pb-4">
                  {points.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">No tagged trades yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={points}>
                        <CartesianGrid strokeDasharray="3 8" strokeOpacity={0.35} stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="value" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" tickLine={false} axisLine={false} />
                        <YAxis dataKey="resultR" tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" tickLine={false} axisLine={false} />
                        <Tooltip {...chartTooltipProps} cursor={false} />
                        <Bar dataKey="resultR" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          {points.map((p, i) => (
                            <Cell
                              key={i}
                              fill={p.resultR >= 0 ? "var(--color-success)" : "var(--color-danger)"}
                              style={{ color: p.resultR >= 0 ? "#6ee7b7" : "#fca5a5" }}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </AccentCard>
              );
            })}
          </div>
        </div>
      )}

      <div data-tour="dashboard-calendar">
        <TradeCalendar trades={unfilteredStats.filteredTrades} variables={variables} />
      </div>
    </div>
  );
}
