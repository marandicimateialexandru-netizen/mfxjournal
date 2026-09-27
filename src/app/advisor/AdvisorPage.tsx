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
import { Sparkles, Target, TrendingDown, Scale, Flame, Snowflake, ShieldAlert, LineChart as LineChartIcon, Dices, BarChart3, Waves, Activity, CalendarDays } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AdvisorMetricCard, AdvisorSectionHeader } from "@/features/advisor/AdvisorVisuals";
import { PatternExplorer } from "@/features/advisor/PatternExplorer";
import { formatR } from "@/lib/format";
import { useStats } from "@/features/stats/useStats";
import { runMonteCarlo, buildHistogram } from "@/features/stats/monteCarlo";
import { dayOfWeekBuckets } from "@/features/stats/pseudoVariables";
import { detectPatterns } from "@/features/patterns/detectedPatterns";
import { FundedAccountSection } from "@/features/advisor/FundedAccountSection";
import { StrategyTesterSection } from "@/features/advisor/StrategyTesterSection";
import { RevenueSimulatorSection } from "@/features/advisor/RevenueSimulatorSection";
import { MfxAiAssistant } from "@/features/advisor/MfxAiAssistant";
import { chartTooltipProps } from "@/lib/chartTheme";

export default function AdvisorPage() {
  const { stats, trades, variables, customResults, settings } = useStats();
  const calcMode = settings?.calc_mode ?? "r";
  const fmt = (r: number) => formatR(r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true });

  const [mcTrades, setMcTrades] = useState(250);
  const [rollingWindow, setRollingWindow] = useState<"all" | 20 | 50 | 100>("all");

  // Was recreated fresh on every render (a plain `.map()`, no useMemo), which silently broke every
  // useMemo below that depends on it — they'd see a "changed" array reference and recompute on
  // every render regardless of whether the underlying trades actually changed, including on
  // totally unrelated state updates elsewhere on this page.
  const historicalR = useMemo(() => stats.filteredTrades.map((t) => t.result_r), [stats.filteredTrades]);

  // Tried deferring these two Monte Carlo passes (1000 + 500 simulated paths) into a post-mount
  // effect so the page could paint before paying for them. That backfired: it made every chart on
  // this page mount with an empty dataset and then receive real data a moment later, and Recharts'
  // internal chart-data store doesn't handle that transition cleanly — it went into a genuine
  // infinite update loop ("Maximum update depth exceeded"), which is a hard crash, strictly worse
  // than the delay it was meant to fix. Back to computing synchronously with useMemo — the actual
  // fix for the entrance stall is `historicalR` finally being a stable reference (see above) so
  // this no longer recomputes on every unrelated render, combined with the nav click in Sidebar
  // already wrapping the route change in `startTransition`, which is what actually keeps the
  // *previous* page interactive while this synchronous work happens instead of appearing frozen.
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="h-5 w-5 text-[var(--color-primary)]" /> AI Trading Advisor
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{stats.totalTrades} trades analyzed</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <AdvisorMetricCard
          icon={Target}
          label="Expectancy"
          value={fmt(stats.expectancyR)}
          tone={stats.expectancyR >= 0 ? "positive" : "negative"}
          caption="per trade"
        />
        <AdvisorMetricCard icon={TrendingDown} label="Max Drawdown" value={fmt(-stats.maxDrawdownR)} tone="negative" caption={`${stats.maxDrawdownTradeCount} trades`} />
        <AdvisorMetricCard icon={Scale} label="Profit Factor" value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} tone="violet" />
        <AdvisorMetricCard icon={Flame} label="Win Streak" value={String(stats.maxWinStreak)} tone="positive" caption="best run" />
        <AdvisorMetricCard icon={Snowflake} label="Loss Streak" value={String(stats.maxLossStreak)} tone="negative" caption="worst run" />
        <AdvisorMetricCard icon={ShieldAlert} label="Ruin Risk" value={`${ruinRisk.toFixed(1)}%`} tone={ruinRisk > 20 ? "negative" : "neutral"} caption="10R+ drawdown odds" />
      </div>

      <Card>
        <CardHeader>
          <AdvisorSectionHeader
            icon={LineChartIcon}
            title="Equity Curve & Drawdown"
            description="Cumulative R across your trade sequence, with underwater depth shaded beneath"
            right={
              <span className={`text-sm font-bold tabular-nums ${stats.totalR >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {fmt(stats.totalR)}
              </span>
            }
          />
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats.equityCurve.map((p, i) => ({ ...p, drawdown: underwaterCurve[i]?.drawdown ?? 0 }))}>
              <defs>
                <linearGradient id="equityLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <linearGradient id="equityAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="tradeIndex" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <Tooltip {...chartTooltipProps} />
              <Area type="monotone" dataKey="cumulativeR" stroke="none" fill="url(#equityAreaGrad)" isAnimationActive={false} />
              <Line type="monotone" dataKey="cumulativeR" stroke="url(#equityLineGrad)" dot={false} strokeWidth={2.5} isAnimationActive={false} />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="var(--color-danger)"
                fill="var(--color-danger)"
                fillOpacity={0.15}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <AdvisorSectionHeader
            icon={Dices}
            title="Monte Carlo Simulation"
            description={`${monteCarlo.totalRDistribution.length.toLocaleString()} simulated paths of ${mcTrades} trades, resampled from your real results`}
            right={
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
            }
          />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-[#8b5cf6]/15 px-2.5 py-1 font-semibold text-[#c4b5fd]">Median {fmt(monteCarlo.medianTotalR)}</span>
              <span className="rounded-full bg-[var(--color-danger)]/15 px-2.5 py-1 font-semibold text-[var(--color-danger)]">Worst 5% {fmt(monteCarlo.worstTotalR5pct)}</span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={totalRHistogram}>
                  <defs>
                    <linearGradient id="mcTotalRGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6d28d9" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bin" tick={{ fontSize: 8 }} stroke="var(--color-text-muted)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                  <Tooltip {...chartTooltipProps} cursor={false} />
                  <Bar dataKey="count" fill="url(#mcTotalRGrad)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-[var(--color-danger)]/15 px-2.5 py-1 font-semibold text-[var(--color-danger)]">Median {monteCarlo.medianMaxDrawdown.toFixed(1)}R</span>
              <span className="rounded-full bg-[var(--color-danger)]/25 px-2.5 py-1 font-semibold text-[var(--color-danger)]">Worst 5% {monteCarlo.worstMaxDrawdown5pct.toFixed(1)}R</span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={drawdownHistogram}>
                  <defs>
                    <linearGradient id="mcDrawdownGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#b91c1c" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bin" tick={{ fontSize: 8 }} stroke="var(--color-text-muted)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                  <Tooltip {...chartTooltipProps} cursor={false} />
                  <Bar dataKey="count" fill="url(#mcDrawdownGrad)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <AdvisorSectionHeader icon={BarChart3} title="R-Multiple Distribution" description={`n=${historicalR.length}, mean=${stats.avgR.toFixed(2)}R`} />
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rMultipleHistogram}>
                <XAxis dataKey="bin" tick={{ fontSize: 8 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                <Tooltip {...chartTooltipProps} cursor={false} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
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
            <AdvisorSectionHeader icon={Waves} title="Underwater Curve" description="How deep and how long each drawdown ran" />
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="70%">
              <ComposedChart data={underwaterCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="tradeIndex" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                <Tooltip {...chartTooltipProps} />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="var(--color-danger)"
                  fill="var(--color-danger)"
                  fillOpacity={0.2}
                  isAnimationActive={false}
                />
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
        <CardHeader>
          <AdvisorSectionHeader
            icon={Activity}
            title="Rolling Performance"
            description="Win rate and expectancy over a moving window of trades"
            right={
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
            }
          />
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rollingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="tradeIndex" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <Tooltip {...chartTooltipProps} />
              <Line type="monotone" dataKey="winRate" stroke="var(--color-primary)" dot={false} name="Win Rate %" isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="expectancy"
                stroke="var(--color-success)"
                dot={false}
                name="Expectancy R"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <AdvisorSectionHeader icon={CalendarDays} title="Edge Map — Day of Week" description="Average R contributed per trade, by weekday" />
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={edgeMap}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <Tooltip {...chartTooltipProps} cursor={false} />
              <Bar dataKey="avgR" radius={[3, 3, 0, 0]} isAnimationActive={false}>
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
        <CardHeader>
          <AdvisorSectionHeader icon={Sparkles} title="Detected Patterns" description="Step through what the AI found — each one comes with a concrete next move" tone="violet" />
        </CardHeader>
        <CardContent>
          <PatternExplorer patterns={patterns} />
        </CardContent>
      </Card>

      <MfxAiAssistant stats={stats} trades={trades} variables={variables} customResults={customResults} settings={settings} />

      <p className="text-center text-xs text-[var(--color-text-muted)]">
        All monetary and prop-firm projections are estimates only — not financial advice.
      </p>
    </div>
  );
}
