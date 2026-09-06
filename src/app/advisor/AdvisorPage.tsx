import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { StatTile } from "@/components/shared/StatTile";
import { formatR } from "@/lib/format";
import { useStats } from "@/features/stats/useStats";
import { runMonteCarlo, buildHistogram } from "@/features/stats/monteCarlo";
import { dayOfWeekBuckets } from "@/features/stats/pseudoVariables";
import { detectPatterns } from "@/features/patterns/detectedPatterns";
import { FundedAccountSection } from "@/features/advisor/FundedAccountSection";
import { StrategyTesterSection } from "@/features/advisor/StrategyTesterSection";
import { RevenueSimulatorSection } from "@/features/advisor/RevenueSimulatorSection";
import { AdvisorChat } from "@/features/advisor/AdvisorChat";
import { chartTooltipProps } from "@/lib/chartTheme";

export default function AdvisorPage() {
  const { stats, trades, variables, customResults, settings } = useStats();
  const calcMode = settings?.calc_mode ?? "r";
  const fmt = (r: number) => formatR(r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true });

  const [mcTrades, setMcTrades] = useState(250);
  const [rollingWindow, setRollingWindow] = useState<"all" | 20 | 50 | 100>("all");

  const historicalR = stats.filteredTrades.map((t) => t.result_r);

  const monteCarlo = useMemo(() => runMonteCarlo(historicalR, { numTrades: mcTrades, numPaths: 1000 }), [historicalR, mcTrades]);
  const ruinRisk = useMemo(() => {
    const mc = runMonteCarlo(historicalR, { numTrades: 100, numPaths: 500 });
    return (mc.maxDrawdownDistribution.filter((d) => d >= 10).length / (mc.maxDrawdownDistribution.length || 1)) * 100;
  }, [historicalR]);

  const rMultipleHistogram = useMemo(() => buildHistogram(historicalR, 16), [historicalR]);
  const totalRHistogram = useMemo(() => buildHistogram(monteCarlo.totalRDistribution, 20), [monteCarlo]);
  const drawdownHistogram = useMemo(() => buildHistogram(monteCarlo.maxDrawdownDistribution, 20), [monteCarlo]);

  const underwaterCurve = useMemo(() => {
    let peak = 0;
    return stats.equityCurve.map((p) => {
      if (p.cumulativeR > peak) peak = p.cumulativeR;
      return { tradeIndex: p.tradeIndex, drawdown: -(peak - p.cumulativeR) };
    });
  }, [stats.equityCurve]);

  const drawdownStreaks = useMemo(() => {
    const streaks: number[] = [];
    let currentLen = 0;
    for (const p of underwaterCurve) {
      if (p.drawdown < 0) currentLen += 1;
      else {
        if (currentLen > 0) streaks.push(currentLen);
        currentLen = 0;
      }
    }
    if (currentLen > 0) streaks.push(currentLen);
    const sorted = [...streaks].sort((a, b) => a - b);
    return {
      shortest: sorted[0] ?? 0,
      median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      longest: sorted[sorted.length - 1] ?? 0,
      currentlyUnderwater: (underwaterCurve[underwaterCurve.length - 1]?.drawdown ?? 0) < 0,
    };
  }, [underwaterCurve]);

  const rollingData = useMemo(() => {
    const window = rollingWindow === "all" ? stats.filteredTrades.length : rollingWindow;
    if (window === 0) return [];
    const result: { tradeIndex: number; winRate: number; expectancy: number }[] = [];
    for (let i = window - 1; i < stats.filteredTrades.length; i++) {
      const slice = stats.filteredTrades.slice(Math.max(0, i - window + 1), i + 1);
      const wins = slice.filter((t) => t.outcome === "win").length;
      const losses = slice.filter((t) => t.outcome === "loss").length;
      const totalR = slice.reduce((sum, t) => sum + t.result_r, 0);
      result.push({
        tradeIndex: i,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        expectancy: totalR / slice.length,
      });
    }
    return result;
  }, [stats.filteredTrades, rollingWindow]);

  const edgeMap = useMemo(() => dayOfWeekBuckets(stats.filteredTrades, customResults), [stats.filteredTrades, customResults]);

  const patterns = useMemo(() => detectPatterns(stats, trades, variables), [stats, trades, variables]);
  const [showAllPatterns, setShowAllPatterns] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="h-5 w-5 text-[var(--color-primary)]" /> AI Trading Advisor
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{stats.totalTrades} trades analyzed</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Expectancy" value={fmt(stats.expectancyR)} tone={stats.expectancyR >= 0 ? "positive" : "negative"} />
        <StatTile label="Max Drawdown" value={fmt(-stats.maxDrawdownR)} tone="negative" />
        <StatTile label="Profit Factor" value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} />
        <StatTile label="Win Streak" value={String(stats.maxWinStreak)} tone="positive" />
        <StatTile label="Loss Streak" value={String(stats.maxLossStreak)} tone="negative" />
        <StatTile label="Ruin Risk" value={`${ruinRisk.toFixed(1)}%`} tone={ruinRisk > 20 ? "negative" : "neutral"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equity Curve & Drawdown</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats.equityCurve.map((p, i) => ({ ...p, drawdown: underwaterCurve[i]?.drawdown ?? 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="tradeIndex" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <Tooltip {...chartTooltipProps} />
              <Line type="monotone" dataKey="cumulativeR" stroke="var(--color-primary)" dot={false} strokeWidth={2} />
              <Area type="monotone" dataKey="drawdown" stroke="var(--color-danger)" fill="var(--color-danger)" fillOpacity={0.15} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Monte Carlo Simulation</CardTitle>
          <Select value={String(mcTrades)} onValueChange={(v) => setMcTrades(Number(v))}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100 trades</SelectItem>
              <SelectItem value="250">250 trades</SelectItem>
              <SelectItem value="500">500 trades</SelectItem>
              <SelectItem value="1000">1000 trades</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-[var(--color-text-muted)]">
              Total R distribution — median {fmt(monteCarlo.medianTotalR)}, worst 5% {fmt(monteCarlo.worstTotalR5pct)}
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={totalRHistogram}>
                  <XAxis dataKey="bin" tick={{ fontSize: 8 }} stroke="var(--color-text-muted)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                  <Tooltip {...chartTooltipProps} cursor={false} />
                  <Bar dataKey="count" fill="var(--color-primary)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-[var(--color-text-muted)]">
              Max drawdown distribution — median {monteCarlo.medianMaxDrawdown.toFixed(1)}R, worst 5%{" "}
              {monteCarlo.worstMaxDrawdown5pct.toFixed(1)}R
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={drawdownHistogram}>
                  <XAxis dataKey="bin" tick={{ fontSize: 8 }} stroke="var(--color-text-muted)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                  <Tooltip {...chartTooltipProps} cursor={false} />
                  <Bar dataKey="count" fill="var(--color-danger)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>R-Multiple Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            <p className="mb-1 text-xs text-[var(--color-text-muted)]">
              n={historicalR.length}, mean={stats.avgR.toFixed(2)}R
            </p>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={rMultipleHistogram}>
                <XAxis dataKey="bin" tick={{ fontSize: 8 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                <Tooltip {...chartTooltipProps} cursor={false} />
                <Bar dataKey="count">
                  {rMultipleHistogram.map((b, i) => (
                    <Cell
                      key={i}
                      fill={b.binStart >= 0 ? "var(--color-success)" : "var(--color-danger)"}
                      style={{ color: b.binStart >= 0 ? "#6ee7b7" : "#fca5a5" }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Underwater Curve</CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="70%">
              <ComposedChart data={underwaterCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="tradeIndex" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                <Tooltip {...chartTooltipProps} />
                <Area type="monotone" dataKey="drawdown" stroke="var(--color-danger)" fill="var(--color-danger)" fillOpacity={0.2} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
              <div>
                <div className="text-[var(--color-text-muted)]">Shortest</div>
                <div className="font-medium">{drawdownStreaks.shortest}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)]">Median</div>
                <div className="font-medium">{drawdownStreaks.median}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)]">Longest</div>
                <div className="font-medium">{drawdownStreaks.longest}</div>
              </div>
            </div>
            {drawdownStreaks.currentlyUnderwater && (
              <p className="pt-1 text-center text-xs text-[var(--color-warning)]">Currently underwater</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Rolling Performance</CardTitle>
          <Select value={String(rollingWindow)} onValueChange={(v) => setRollingWindow(v === "all" ? "all" : (Number(v) as 20 | 50 | 100))}>
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="20">Last 20</SelectItem>
              <SelectItem value="50">Last 50</SelectItem>
              <SelectItem value="100">Last 100</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rollingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="tradeIndex" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <Tooltip {...chartTooltipProps} />
              <Line type="monotone" dataKey="winRate" stroke="var(--color-primary)" dot={false} name="Win Rate %" />
              <Line type="monotone" dataKey="expectancy" stroke="var(--color-success)" dot={false} name="Expectancy R" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edge Map — Day of Week</CardTitle>
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={edgeMap}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <Tooltip {...chartTooltipProps} cursor={false} />
              <Bar dataKey="avgR">
                {edgeMap.map((b, i) => (
                  <Cell
                    key={i}
                    fill={b.avgR >= 0 ? "var(--color-success)" : "var(--color-danger)"}
                    style={{ color: b.avgR >= 0 ? "#6ee7b7" : "#fca5a5" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <FundedAccountSection historicalR={historicalR} />

      <StrategyTesterSection
        trades={stats.filteredTrades}
        variables={variables}
        customResults={customResults}
        calcMode={calcMode}
        riskPercent={settings?.risk_per_r_percent}
        riskDollar={settings?.risk_per_r_dollar}
      />

      <RevenueSimulatorSection stats={stats} riskPerTradePct={settings?.risk_per_r_percent ?? 1} />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Detected Patterns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(showAllPatterns ? patterns : patterns.slice(0, 8)).map((p, i) => (
            <p key={i} className="text-sm">
              • {p.text}
            </p>
          ))}
          {patterns.length > 8 && (
            <button
              onClick={() => setShowAllPatterns((v) => !v)}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {showAllPatterns ? "Show less" : `Show all (${patterns.length})`}
            </button>
          )}
          {patterns.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Not enough data yet.</p>}
        </CardContent>
      </Card>

      <AdvisorChat apiKey={settings?.ai_api_key} stats={stats} />

      <p className="text-center text-xs text-[var(--color-text-muted)]">
        All monetary and prop-firm projections are estimates only — not financial advice.
      </p>
    </div>
  );
}
