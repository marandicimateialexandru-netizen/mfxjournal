import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/shared/StatTile";
import { runFundedAccountSimulation, type PayoutFrequency } from "@/features/stats/fundedAccountSimulation";
import { chartTooltipProps } from "@/lib/chartTheme";

export function FundedAccountSection({ historicalR }: { historicalR: number[] }) {
  const [accountType, setAccountType] = useState<"safe" | "static" | "elastic">("static");
  const [maxDrawdownPct, setMaxDrawdownPct] = useState(10);
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>("monthly");
  const [riskPerTradePct, setRiskPerTradePct] = useState(1);

  const result = useMemo(
    () =>
      runFundedAccountSimulation(historicalR, {
        accountType,
        maxDrawdownPct,
        payoutFrequency,
        riskPerTradePct,
        tradesPerPeriod: 20,
        numPaths: 500,
        maxTradesPerPath: 300,
      }),
    [historicalR, accountType, maxDrawdownPct, payoutFrequency, riskPerTradePct],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funded Account Simulation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Account Type</Label>
            <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="safe">Safe</SelectItem>
                <SelectItem value="static">Static</SelectItem>
                <SelectItem value="elastic">Elastic (Trailing)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Drawdown %</Label>
            <Input type="number" className="h-8" value={maxDrawdownPct} onChange={(e) => setMaxDrawdownPct(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payout Frequency</Label>
            <Select value={payoutFrequency} onValueChange={(v) => setPayoutFrequency(v as PayoutFrequency)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Risk per Trade %</Label>
            <Input type="number" step="0.1" className="h-8" value={riskPerTradePct} onChange={(e) => setRiskPerTradePct(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Risk of Ruin" value={`${result.riskOfRuinPct.toFixed(1)}%`} tone={result.riskOfRuinPct > 30 ? "negative" : "neutral"} />
          <StatTile label="Median Payouts" value={String(result.medianSuccessfulPayouts)} />
          <StatTile label="Avg Trades to Ruin" value={result.avgTradesToRuin.toFixed(0)} />
          <StatTile
            label="Avg Payout Size"
            value={`${result.avgPayoutSizePct.median.toFixed(1)}%`}
            sub={`${result.avgPayoutSizePct.worst.toFixed(1)}% – ${result.avgPayoutSizePct.best.toFixed(1)}%`}
          />
        </div>

        <div className="h-48">
          <p className="mb-1 text-xs text-[var(--color-text-muted)]">Cumulative Survival Rate</p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.survivalCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="tradeIndex" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" domain={[0, 100]} />
              <Tooltip {...chartTooltipProps} />
              <Area type="monotone" dataKey="survivalPct" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Projections only — actual results depend on market conditions, drawdown, and prop firm rules.
        </p>
      </CardContent>
    </Card>
  );
}
