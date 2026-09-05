import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatR } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";
import { useTrades, useTradeMutations } from "@/features/trades/useTrades";
import { useVariables } from "@/features/variables/useVariables";
import { useSettings } from "@/features/settings/useSettings";
import { TradeDetailModal } from "@/features/trades/TradeDetailModal";
import type { Trade } from "@/db/types";

type SortKey = "entry_time" | "market" | "outcome" | "result_r";

const OUTCOME_VARIANT: Record<string, "win" | "loss" | "be"> = { win: "win", loss: "loss", be: "be" };

export default function JournalPage() {
  const { data: trades = [] } = useTrades();
  const { data: variables = [] } = useVariables();
  const { data: settings } = useSettings();
  const { deleteTrades } = useTradeMutations();
  const openAddTradeModal = useUiStore((s) => s.openAddTradeModal);

  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("entry_time");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);

  const calcMode = settings?.calc_mode ?? "r";

  const filtered = useMemo(() => {
    let result = trades;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.market?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q),
      );
    }
    if (outcomeFilter !== "all") {
      result = result.filter((t) => t.outcome === outcomeFilter);
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "entry_time") cmp = new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime();
      else if (sortKey === "market") cmp = (a.market ?? "").localeCompare(b.market ?? "");
      else if (sortKey === "outcome") cmp = a.outcome.localeCompare(b.outcome);
      else if (sortKey === "result_r") cmp = a.result_r - b.result_r;
      return cmp * sortDir;
    });
  }, [trades, search, outcomeFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    await deleteTrades.mutateAsync([...selected]);
    setSelected(new Set());
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Journal</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            All your trade entries ({filtered.length} of {trades.length} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" /> Delete ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={() => openAddTradeModal()}>
            <Plus className="h-4 w-4" /> New Trade
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search symbol or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="win">Win</SelectItem>
            <SelectItem value="loss">Loss</SelectItem>
            <SelectItem value="be">Break Even</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] text-left text-[var(--color-text-muted)]">
              <th className="w-8 p-2"></th>
              {(
                [
                  ["entry_time", "Date"],
                  ["market", "Market"],
                  ["outcome", "Outcome"],
                  ["result_r", "Result"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th key={key} className="cursor-pointer select-none p-2 font-medium" onClick={() => toggleSort(key)}>
                  <span className="inline-flex items-center gap-1">
                    {label} <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
              ))}
              <th className="p-2 font-medium">Variables</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]"
                onClick={() => setActiveTrade(t)}
              >
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                </td>
                <td className="p-2">{format(new Date(t.entry_time), "MMM d, yyyy")}</td>
                <td className="p-2">{t.market ?? "—"}</td>
                <td className="p-2">
                  <Badge variant={OUTCOME_VARIANT[t.outcome] ?? "default"}>{t.outcome}</Badge>
                </td>
                <td
                  className={`p-2 tabular-nums font-medium ${
                    t.result_r > 0 ? "text-[var(--color-success)]" : t.result_r < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"
                  }`}
                >
                  {formatR(t.result_r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true })}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {variables.slice(0, 2).map((v) => {
                      const tagged = t.variableValues?.[v.id];
                      const value = v.values.find((val) => val.id === tagged?.valueId);
                      if (!value) return null;
                      return (
                        <Badge key={v.id} variant="outline">
                          {value.label}
                        </Badge>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--color-text-muted)]">
                  No trades found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TradeDetailModal
        trade={activeTrade}
        trades={filtered}
        variables={variables}
        onClose={() => setActiveTrade(null)}
        onNavigate={setActiveTrade}
      />
    </div>
  );
}
