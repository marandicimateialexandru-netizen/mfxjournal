import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { usePropFirmRows } from "./usePropFirmRows";
import type { StatsResult } from "@/features/stats/types";

export function RevenueSimulatorSection({ stats, riskPerTradePct }: { stats: StatsResult; riskPerTradePct: number }) {
  const { data: rows = [], create, update, remove } = usePropFirmRows();
  const [source, setSource] = useState<"stats" | "custom">("stats");
  const [customMonthlyPct, setCustomMonthlyPct] = useState(5);

  const tradesPerMonth = useMemo(() => {
    if (stats.filteredTrades.length < 2) return 0;
    const first = new Date(stats.filteredTrades[0].entry_time);
    const last = new Date(stats.filteredTrades[stats.filteredTrades.length - 1].entry_time);
    const months = Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return stats.filteredTrades.length / months;
  }, [stats.filteredTrades]);

  const monthlyPct = source === "custom" ? customMonthlyPct : stats.avgR * riskPerTradePct * tradesPerMonth;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Simulator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Select value={source} onValueChange={(v) => setSource(v as any)}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stats">From my stats</SelectItem>
              <SelectItem value="custom">Custom rate</SelectItem>
            </SelectContent>
          </Select>
          {source === "custom" && (
            <Input
              type="number"
              className="h-8 w-24"
              value={customMonthlyPct}
              onChange={(e) => setCustomMonthlyPct(Number(e.target.value))}
            />
          )}
          <span className="text-xs text-[var(--color-text-muted)]">
            {source === "stats"
              ? `${stats.avgR.toFixed(2)}R avg × ${riskPerTradePct}% risk × ${tradesPerMonth.toFixed(1)} trades/mo = ${monthlyPct.toFixed(2)}% monthly`
              : `${customMonthlyPct}% monthly`}
          </span>
        </div>

        <div className="space-y-2">
          {rows.map((row) => {
            const grossMonthly = row.capital * (monthlyPct / 100);
            const netMonthly = grossMonthly * (row.profit_split_pct / 100);
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-border)] p-2">
                <Input
                  className="h-8 w-32"
                  defaultValue={row.account_name}
                  onBlur={(e) => update.mutate({ id: row.id, patch: { account_name: e.target.value } })}
                />
                <Input
                  type="number"
                  className="h-8 w-28"
                  defaultValue={row.capital}
                  onBlur={(e) => update.mutate({ id: row.id, patch: { capital: Number(e.target.value) } })}
                />
                <Input
                  type="number"
                  className="h-8 w-20"
                  defaultValue={row.profit_split_pct}
                  onBlur={(e) => update.mutate({ id: row.id, patch: { profit_split_pct: Number(e.target.value) } })}
                />
                <Select
                  value={row.payout_frequency}
                  onValueChange={(v) => update.mutate({ id: row.id, patch: { payout_frequency: v } })}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                  Net Monthly: ${netMonthly.toFixed(0)} · Net Yearly: ${(netMonthly * 12).toFixed(0)}
                </span>
                <button onClick={() => remove.mutate(row.id)} className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <Button size="sm" variant="outline" onClick={() => create.mutate()}>
          <Plus className="h-4 w-4" /> Add Prop Firm
        </Button>

        <p className="text-xs text-[var(--color-text-muted)]">
          Projections only — actual results depend on market conditions, drawdown, and prop firm rules.
        </p>
      </CardContent>
    </Card>
  );
}
