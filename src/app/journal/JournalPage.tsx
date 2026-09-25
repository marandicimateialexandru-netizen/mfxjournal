import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, ArrowUpDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
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

const COLUMNS: [SortKey, string][] = [
  ["entry_time", "Date"],
  ["market", "Market"],
  ["outcome", "Outcome"],
  ["result_r", "Result"],
];

// Shared by the header and every row so they always line up — a plain <table> can't be virtualized
// (its layout algorithm needs every row present to size columns), so this is a CSS-grid table
// look-alike instead, with column widths fixed here rather than left to auto-layout.
const GRID_COLS = "40px 130px minmax(0,1fr) 110px 120px minmax(0,1.6fr)";
const ROW_HEIGHT = 44;

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

  // Only the rows scrolled into view (plus a small overscan buffer) ever exist in the DOM — at 18
  // trades that's moot, but this page has no cap on trade count, and a few thousand real <tr>
  // elements (each with a checkbox, a badge, hover/click handlers) is a genuinely slow mount and a
  // sluggish scroll, not just a theoretical concern once a journal has real trading history behind it.
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

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

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <div
          className="grid border-b border-[var(--color-border)] bg-[var(--color-surface)] text-left text-sm text-[var(--color-text-muted)]"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="p-2" />
          {COLUMNS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleSort(key)}
              className="flex cursor-pointer select-none items-center gap-1 p-2 text-left font-medium"
            >
              {label} <ArrowUpDown className="h-3 w-3" />
            </button>
          ))}
          <div className="p-2 font-medium">Variables</div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">No trades found.</div>
        ) : (
          <div ref={scrollRef} className="h-[65vh] overflow-y-auto">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const t = filtered[virtualRow.index];
                return (
                  <div
                    key={t.id}
                    className="absolute left-0 top-0 grid w-full cursor-pointer items-center border-b border-[var(--color-border)] text-sm last:border-0 hover:bg-[var(--color-surface)]"
                    style={{
                      gridTemplateColumns: GRID_COLS,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => setActiveTrade(t)}
                  >
                    <div className="p-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                    </div>
                    <div className="truncate p-2">{format(new Date(t.entry_time), "MMM d, yyyy")}</div>
                    <div className="truncate p-2">{t.market ?? "—"}</div>
                    <div className="p-2">
                      <Badge variant={OUTCOME_VARIANT[t.outcome] ?? "default"}>{t.outcome}</Badge>
                    </div>
                    <div
                      className={`p-2 tabular-nums font-medium ${
                        t.result_r > 0
                          ? "text-[var(--color-success)]"
                          : t.result_r < 0
                            ? "text-[var(--color-danger)]"
                            : "text-[var(--color-warning)]"
                      }`}
                    >
                      {formatR(t.result_r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true })}
                    </div>
                    <div className="flex flex-wrap gap-1 overflow-hidden p-2">
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
