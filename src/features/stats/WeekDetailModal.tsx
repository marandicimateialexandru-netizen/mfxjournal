import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowUpDown, Maximize2, Minimize2, Trash2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TradeFullDetailModal } from "@/features/trades/TradeFullDetailModal";
import { computeStats } from "@/features/stats/computeStats";
import { useSettings } from "@/features/settings/useSettings";
import { useTradeMutations } from "@/features/trades/useTrades";
import { formatR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Trade } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";
import { ignoreTourOutsideClicks } from "@/features/tour/ignoreTourOutsideClicks";

type SortKey = "entry_time" | "market" | "outcome" | "result_r";

const OUTCOME_VARIANT: Record<string, "win" | "loss" | "be"> = { win: "win", loss: "loss", be: "be" };

/** Same "tint everything to the result's sign" language as the trade detail modal's outcome
 *  colors, just keyed off the week's total R instead of a single trade's outcome — a losing week
 *  reads red at a glance, a winning one green, before a single number has to be read. */
function totalTone(totalR: number): { cssVar: string; badge: "win" | "loss" | "be" } {
  if (totalR > 0) return { cssVar: "--color-success", badge: "win" };
  if (totalR < 0) return { cssVar: "--color-danger", badge: "loss" };
  return { cssVar: "--color-warning", badge: "be" };
}

function StatTile({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-center">
      <div className={cn("text-3xl font-extrabold tabular-nums", tone ?? "text-[var(--color-text)]")}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

export function WeekDetailModal({
  weekLabel,
  trades,
  variables,
  onClose,
}: {
  weekLabel: string;
  trades: Trade[];
  variables: VariableWithValues[];
  onClose: () => void;
}) {
  const { data: settings } = useSettings();
  const { deleteTrades } = useTradeMutations();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("entry_time");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [expanded, setExpanded] = useState(false);
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);

  const calcMode = settings?.calc_mode ?? "r";
  const stats = useMemo(() => computeStats(trades), [trades]);
  const tone = totalTone(stats.totalR);

  const sorted = useMemo(() => {
    return [...trades].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "entry_time") cmp = new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime();
      else if (sortKey === "market") cmp = (a.market ?? "").localeCompare(b.market ?? "");
      else if (sortKey === "outcome") cmp = a.outcome.localeCompare(b.outcome);
      else if (sortKey === "result_r") cmp = a.result_r - b.result_r;
      return cmp * sortDir;
    });
  }, [trades, sortKey, sortDir]);

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

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === sorted.length ? new Set() : new Set(sorted.map((t) => t.id))));
  }

  async function handleBulkDelete() {
    await deleteTrades.mutateAsync([...selected]);
    setSelected(new Set());
  }

  const columns: [SortKey, string][] = [
    ["entry_time", "Date"],
    ["market", "Symbol"],
    ["outcome", "Outcome"],
    ["result_r", "Result"],
  ];

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          hideClose
          data-tour="week-modal"
          onInteractOutside={ignoreTourOutsideClicks}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0 transition-[max-width,height] duration-200",
            expanded ? "h-[92vh] max-w-[95vw]" : "max-h-[88vh] max-w-3xl",
          )}
          style={{
            borderColor: `color-mix(in srgb, var(${tone.cssVar}) 35%, var(--color-border))`,
            boxShadow: `0 25px 70px -20px rgba(0,0,0,0.7), 0 0 70px -24px color-mix(in srgb, var(${tone.cssVar}) 55%, transparent)`,
          }}
        >
          <div
            className="h-1 shrink-0"
            style={{
              background: `linear-gradient(90deg, color-mix(in srgb, var(${tone.cssVar}) 85%, white), var(${tone.cssVar}))`,
            }}
          />

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <h2 className="text-lg font-bold text-[var(--color-text)]">{weekLabel}</h2>
              <Badge variant={tone.badge} className="shrink-0 font-bold">
                {trades.length} trade{trades.length === 1 ? "" : "s"} ·{" "}
                {formatR(stats.totalR, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true })}
              </Badge>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button size="icon" variant="ghost" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={onClose} data-tour="week-modal-close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid grid-cols-3 gap-3">
              <StatTile value={String(stats.totalTrades)} label="Trades" />
              <StatTile value={`${stats.winRatePct.toFixed(1)}%`} label="Win Rate" tone="text-[var(--color-warning)]" />
              <StatTile value={`${stats.beRatePct.toFixed(1)}%`} label="BE Rate" tone="text-[var(--color-warning)]" />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Trades this week</h3>
              {selected.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete ({selected.size})
                </Button>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)] text-left text-[var(--color-text-muted)]">
                    <th className="w-9 p-2.5">
                      <Checkbox checked={sorted.length > 0 && selected.size === sorted.length} onCheckedChange={toggleSelectAll} />
                    </th>
                    {columns.map(([key, label]) => (
                      <th
                        key={key}
                        className="cursor-pointer select-none p-2.5 text-xs font-semibold uppercase tracking-wide"
                        onClick={() => toggleSort(key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <ArrowUpDown className={cn("h-3 w-3", sortKey === key ? "text-[var(--color-text)]" : "opacity-40")} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t) => (
                    <tr
                      key={t.id}
                      className="cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-background)]"
                      onClick={() => setActiveTrade(t)}
                    >
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                      </td>
                      <td className="p-2.5">
                        <div className="font-semibold text-[var(--color-text)]">{format(new Date(t.entry_time), "MMM d, yyyy")}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{format(new Date(t.entry_time), "HH:mm")}</div>
                      </td>
                      <td className="p-2.5 font-medium text-[var(--color-text)]">{t.market ?? "—"}</td>
                      <td className="p-2.5">
                        <Badge variant={OUTCOME_VARIANT[t.outcome] ?? "default"}>{t.outcome}</Badge>
                      </td>
                      <td
                        className={cn(
                          "p-2.5 tabular-nums font-bold",
                          t.result_r > 0
                            ? "text-[var(--color-success)]"
                            : t.result_r < 0
                              ? "text-[var(--color-danger)]"
                              : "text-[var(--color-warning)]",
                        )}
                      >
                        {formatR(t.result_r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true })}
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[var(--color-text-muted)]">
                        No trades this week.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TradeFullDetailModal
        trade={activeTrade}
        trades={sorted}
        variables={variables}
        onClose={() => setActiveTrade(null)}
        onNavigate={setActiveTrade}
      />
    </>
  );
}
