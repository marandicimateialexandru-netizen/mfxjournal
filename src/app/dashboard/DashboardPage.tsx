import { useMemo, useState } from "react";
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
  Percent,
  Minus,
  Target,
  BarChart3,
  Gauge as GaugeIcon,
  Flame,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { OutcomeDonut } from "@/components/shared/OutcomeDonut";
import { AppScoreRadar } from "@/components/shared/AppScoreRadar";
import { EquityCurveChart } from "@/components/shared/EquityCurveChart";
import { TradeCalendar } from "@/features/stats/TradeCalendar";
import { VariablesSection } from "@/features/dashboard/VariablesSection";
import { CustomCombinationsSection } from "@/features/dashboard/CustomCombinationsSection";
import { formatR, formatPct } from "@/lib/format";
import { chartTooltipProps } from "@/lib/chartTheme";
import { useStats } from "@/features/stats/useStats";
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
  const calcMode = settings?.calc_mode ?? "r";
  const dateRange = useUiStore((s) => s.dateRange);
  const setDateRange = useUiStore((s) => s.setDateRange);
  const beInWinRate = useUiStore((s) => s.beInWinRate);
  const toggleBeInWinRate = useUiStore((s) => s.toggleBeInWinRate);
  const hideBeRateColor = useUiStore((s) => s.hideBeRateColor);
  const toggleHideBeRateColor = useUiStore((s) => s.toggleHideBeRateColor);
  const showLossRateColor = useUiStore((s) => s.showLossRateColor);
  const toggleShowLossRateColor = useUiStore((s) => s.toggleShowLossRateColor);
  const [search, setSearch] = useState("");

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
    for (const totalR of byDay.values()) {
      if (totalR > beRange) wins += 1;
      else if (totalR < -beRange) losses += 1;
    }
    return { wins, losses, pct: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0 };
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

  const filteredTradesForSearch = search.trim()
    ? stats.filteredTrades.filter(
        (t) => t.market?.toLowerCase().includes(search.toLowerCase()) || t.notes?.toLowerCase().includes(search.toLowerCase()),
      )
    : stats.filteredTrades;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Your trading performance at a glance</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search symbol or notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
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
            <Button variant="outline" size="sm">
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
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
        />
        <StatTile
          label="BE Rate"
          value={formatPct(stats.beRatePct)}
          icon={Minus}
          iconTone={hideBeRateColor ? "slate" : "amber"}
          tone={hideBeRateColor ? "neutral" : "warning"}
          countTo={stats.beRatePct}
          format={(n) => formatPct(n)}
        />
        <StatTile
          label="Avg R"
          value={fmt(stats.avgR)}
          icon={BarChart3}
          tone={stats.avgR >= 0 ? "positive" : "negative"}
          countTo={stats.avgR}
          format={fmt}
        />
        <StatTile
          label="Current Streak"
          value={stats.currentStreak.type === "none" ? "—" : `${stats.currentStreak.count} ${stats.currentStreak.type}`}
          icon={Flame}
          iconTone={stats.currentStreak.type === "win" ? "green" : stats.currentStreak.type === "loss" ? "red" : "slate"}
          tone={stats.currentStreak.type === "win" ? "positive" : stats.currentStreak.type === "loss" ? "negative" : "neutral"}
        />
        <StatTile
          label="Max Drawdown"
          value={fmt(-stats.maxDrawdownR)}
          icon={Percent}
          tone="negative"
          countTo={-stats.maxDrawdownR}
          format={fmt}
        />

        <div className="col-span-2">
          <StatTile
            label="Win Rate"
            value={formatPct(stats.winRatePct)}
            icon={Target}
            iconTone="teal"
            info="Wins / (Wins + Losses), breakevens excluded."
            countTo={stats.winRatePct}
            format={(n) => formatPct(n)}
            gauge={<ArcGauge winPct={stats.winRatePct} winLabel={stats.wins} lossLabel={stats.losses} width={84} />}
          />
        </div>
        <div className="col-span-2">
          <StatTile
            label="Day Win %"
            value={formatPct(dayWin.pct)}
            icon={CalendarCheck}
            iconTone="teal"
            info="Share of trading days that closed net positive, using the breakeven range set in Settings."
            countTo={dayWin.pct}
            format={(n) => formatPct(n)}
            gauge={<ArcGauge winPct={dayWin.pct} winLabel={dayWin.wins} lossLabel={dayWin.losses} width={84} />}
          />
        </div>
        <div className="col-span-2">
          <StatTile
            label="Profit Factor"
            value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"}
            icon={GaugeIcon}
            iconTone="green"
            info="Sum of winning R divided by the absolute sum of losing R."
            countTo={Number.isFinite(stats.profitFactor) ? stats.profitFactor : undefined}
            format={(n) => n.toFixed(2)}
            gauge={
              <RadialGauge
                value={Math.min(100, (Number.isFinite(stats.profitFactor) ? stats.profitFactor : 3) * (100 / 3))}
                size={44}
                strokeWidth={5}
                gradient={["#34d399", "#059669"]}
                showValue={false}
              />
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <EquityCurveChart equityCurve={stats.equityCurve} totalR={stats.totalR} />

        <Card>
          <CardHeader>
            <CardTitle>App Score</CardTitle>
          </CardHeader>
          <CardContent>
            <AppScoreRadar breakdown={appScore} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Outcome Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-52">
            <OutcomeDonut wins={stats.wins} losses={stats.losses} bes={stats.breakEvens} total={stats.totalTrades} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Daily P&L</CardTitle>
          </CardHeader>
          <CardContent className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyPnl}>
                <defs>
                  <linearGradient id="dailyGain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
                <Tooltip {...chartTooltipProps} cursor={false} />
                <Bar dataKey="r" radius={[4, 4, 0, 0]}>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-52">
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
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
                <Tooltip {...chartTooltipProps} cursor={false} />
                <Bar dataKey="r" radius={[4, 4, 0, 0]}>
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
          </CardContent>
        </Card>
      </div>

      <VariablesSection />

      <CustomCombinationsSection />

      {numberVariables.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Number Variables</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {numberVariables.map((v) => {
              const points = numberVariableSeries(stats.filteredTrades, v.id);
              return (
                <Card key={v.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconBadge emoji={v.icon ?? "🔢"} tone={toneForKey(v.id)} size={26} />
                      {v.label} vs Result R
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-48">
                    {points.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-muted)]">No tagged trades yet.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={points}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="value" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                          <YAxis dataKey="resultR" tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
                          <Tooltip {...chartTooltipProps} cursor={false} />
                          <Bar dataKey="resultR">
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <TradeCalendar trades={filteredTradesForSearch} variables={variables} />
    </div>
  );
}
