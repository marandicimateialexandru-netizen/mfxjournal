import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { computeStats } from "@/features/stats/computeStats";
import { formatPct, formatR } from "@/lib/format";
import type { Trade, CustomResult, CalcMode } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

type RuleAction = "only_trade" | "do_not_trade" | "reduce_risk";

interface Rule {
  id: string;
  action: RuleAction;
  variableId: string;
  valueIds: string[];
  enabled: boolean;
}

function matches(trade: Trade, rule: Rule): boolean {
  const tagged = trade.variableValues?.[rule.variableId]?.valueId;
  return tagged != null && rule.valueIds.includes(tagged);
}

function applyRules(trades: Trade[], rules: Rule[]): Trade[] {
  const active = rules.filter((r) => r.enabled && r.variableId && r.valueIds.length > 0);
  const onlyTradeRules = active.filter((r) => r.action === "only_trade");
  const doNotTradeRules = active.filter((r) => r.action === "do_not_trade");
  const reduceRiskRules = active.filter((r) => r.action === "reduce_risk");

  return trades
    .filter((t) => (onlyTradeRules.length === 0 ? true : onlyTradeRules.some((r) => matches(t, r))))
    .filter((t) => !doNotTradeRules.some((r) => matches(t, r)))
    .map((t) => {
      const reduced = reduceRiskRules.some((r) => matches(t, r));
      return reduced ? { ...t, result_r: t.result_r * 0.5 } : t;
    });
}

export function StrategyTesterSection({
  trades,
  variables,
  customResults,
  calcMode,
  riskPercent,
  riskDollar,
}: {
  trades: Trade[];
  variables: VariableWithValues[];
  customResults: CustomResult[];
  calcMode: CalcMode;
  riskPercent?: number | null;
  riskDollar?: number | null;
}) {
  const [rules, setRules] = useState<Rule[]>([]);

  const originalStats = useMemo(() => computeStats(trades, { customResults }), [trades, customResults]);
  const simulatedTrades = useMemo(() => applyRules(trades, rules), [trades, rules]);
  const simulatedStats = useMemo(() => computeStats(simulatedTrades, { customResults }), [simulatedTrades, customResults]);

  function addRule() {
    setRules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), action: "do_not_trade", variableId: variables[0]?.id ?? "", valueIds: [], enabled: true },
    ]);
  }

  function updateRule(id: string, patch: Partial<Rule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  const fmt = (r: number) => formatR(r, calcMode, riskPercent, riskDollar, { showSign: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
            Test Your Edge — create a rule to see the simulated impact of trading (or not trading) a specific
            variable value.
          </div>
        )}
        {rules.map((rule) => {
          const variable = variables.find((v) => v.id === rule.variableId);
          return (
            <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-border)] p-2">
              <Switch checked={rule.enabled} onCheckedChange={(v) => updateRule(rule.id, { enabled: v })} />
              <Select value={rule.action} onValueChange={(v) => updateRule(rule.id, { action: v as RuleAction })}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="only_trade">Only trade</SelectItem>
                  <SelectItem value="do_not_trade">Do not trade</SelectItem>
                  <SelectItem value="reduce_risk">Reduce risk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rule.variableId} onValueChange={(v) => updateRule(rule.id, { variableId: v, valueIds: [] })}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="Variable" />
                </SelectTrigger>
                <SelectContent>
                  {variables.filter((v) => v.type === "text").map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1">
                {variable?.values.map((val) => (
                  <button
                    key={val.id}
                    onClick={() =>
                      updateRule(rule.id, {
                        valueIds: rule.valueIds.includes(val.id)
                          ? rule.valueIds.filter((id) => id !== val.id)
                          : [...rule.valueIds, val.id],
                      })
                    }
                  >
                    <Badge variant={rule.valueIds.includes(val.id) ? "default" : "outline"}>{val.label}</Badge>
                  </button>
                ))}
              </div>
              <button onClick={() => removeRule(rule.id)} className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        <Button size="sm" variant="outline" onClick={addRule}>
          <Plus className="h-4 w-4" /> Add Rule
        </Button>

        {rules.length > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-md border border-[var(--color-border)] p-3">
              <p className="mb-1 text-xs text-[var(--color-text-muted)]">Original</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(originalStats.totalR)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatPct(originalStats.winRatePct)} WR · {originalStats.totalTrades} trades
              </p>
            </div>
            <div className="rounded-md border border-[var(--color-primary)] p-3">
              <p className="mb-1 text-xs text-[var(--color-text-muted)]">Simulated</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(simulatedStats.totalR)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatPct(simulatedStats.winRatePct)} WR · {simulatedStats.totalTrades} trades
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
