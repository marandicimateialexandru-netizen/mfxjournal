import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useStrategies, useStrategyMutations } from "@/features/strategy/useStrategies";
import { useUiStore } from "@/store/uiStore";
import { useStats } from "@/features/stats/useStats";
import { formatR, formatPct } from "@/lib/format";

export default function StrategyPage() {
  const { data: strategies = [] } = useStrategies();
  const { createStrategy } = useStrategyMutations();
  const strategyId = useUiStore((s) => s.strategyId);
  const setStrategyId = useUiStore((s) => s.setStrategyId);
  const { settings } = useStats();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📈");
  const [description, setDescription] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    await createStrategy.mutateAsync({ name, icon, description });
    setOpen(false);
    setName("");
    setDescription("");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Trading Strategies</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Organize and analyze your approaches separately.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Strategy
        </Button>
      </div>

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-muted)]">
        Each strategy is a filter — select one to scope Dashboard, Report, and AI Advisor to just that
        strategy's trades, computed independently over the same data.
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <StrategyCard
          active={strategyId === null}
          icon="📊"
          name="All Trades"
          description="No strategy filter"
          onClick={() => setStrategyId(null)}
        />
        {strategies.map((s) => (
          <StrategyCardWithStats
            key={s.id}
            id={s.id}
            icon={s.icon ?? "📈"}
            name={s.name}
            description={s.description}
            active={strategyId === s.id}
            onClick={() => setStrategyId(s.id)}
            calcMode={settings?.calc_mode ?? "r"}
            riskPercent={settings?.risk_per_r_percent}
            riskDollar={settings?.risk_per_r_dollar}
          />
        ))}
        <button
          onClick={() => setOpen(true)}
          className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <Plus className="h-5 w-5" />
          Add Strategy
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Strategy</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="w-16 space-y-1.5">
                <Label>Icon</Label>
                <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="text-center" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ICT Scalping" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StrategyCard({
  icon,
  name,
  description,
  active,
  onClick,
}: {
  icon: string;
  name: string;
  description?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-colors ${active ? "border-[var(--color-primary)]" : ""}`}
    >
      <CardContent className="p-4">
        <div className="mb-2 text-2xl">{icon}</div>
        <div className="font-medium">{name}</div>
        {description && <div className="text-xs text-[var(--color-text-muted)]">{description}</div>}
      </CardContent>
    </Card>
  );
}

function StrategyCardWithStats({
  id,
  icon,
  name,
  description,
  active,
  onClick,
  calcMode,
  riskPercent,
  riskDollar,
}: {
  id: string;
  icon: string;
  name: string;
  description?: string | null;
  active: boolean;
  onClick: () => void;
  calcMode: "r" | "percent" | "dollar";
  riskPercent?: number | null;
  riskDollar?: number | null;
}) {
  const { stats } = useStats({ strategyId: id });
  return (
    <Card onClick={onClick} className={`cursor-pointer transition-colors ${active ? "border-[var(--color-primary)]" : ""}`}>
      <CardContent className="p-4 space-y-2">
        <div className="text-2xl">{icon}</div>
        <div className="font-medium">{name}</div>
        {description && <div className="text-xs text-[var(--color-text-muted)]">{description}</div>}
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] pt-1">
          <span>{stats.totalTrades} trades</span>
          <span>{formatPct(stats.winRatePct)} WR</span>
          <span className={stats.totalR >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
            {formatR(stats.totalR, calcMode, riskPercent, riskDollar, { showSign: true })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
