import { ChevronLeft, ChevronRight, Pencil, Copy, Trash2, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatR } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";
import { useSettings } from "@/features/settings/useSettings";
import { useTradeMutations } from "./useTrades";
import type { Trade } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

const OUTCOME_VARIANT: Record<string, "win" | "loss" | "be"> = { win: "win", loss: "loss", be: "be" };

export function TradeDetailModal({
  trade,
  trades,
  variables,
  onClose,
  onNavigate,
}: {
  trade: Trade | null;
  trades: Trade[];
  variables: VariableWithValues[];
  onClose: () => void;
  onNavigate: (trade: Trade) => void;
}) {
  const { data: settings } = useSettings();
  const openAddTradeModal = useUiStore((s) => s.openAddTradeModal);
  const { deleteTrade, createTrade } = useTradeMutations();

  if (!trade) return null;
  const index = trades.findIndex((t) => t.id === trade.id);
  const calcMode = settings?.calc_mode ?? "r";

  function findVariableValue(variableId: string) {
    const variable = variables.find((v) => v.id === variableId);
    if (!variable) return null;
    const tagged = trade!.variableValues?.[variableId];
    if (variable.type === "number") return tagged?.numberValue != null ? String(tagged.numberValue) : null;
    const value = variable.values.find((v) => v.id === tagged?.valueId);
    return value ? `${value.icon ?? ""} ${value.label}` : null;
  }

  return (
    <Dialog open={!!trade} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              {trade.market ?? "—"}
              <Badge variant={OUTCOME_VARIANT[trade.outcome] ?? "default"}>{trade.outcome}</Badge>
            </DialogTitle>
            <span className="text-xs text-[var(--color-text-muted)]">
              {index + 1} / {trades.length}
            </span>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <div>
            <div className="text-xs text-[var(--color-text-muted)]">Result</div>
            <div
              className={`text-2xl font-semibold tabular-nums ${
                trade.result_r > 0 ? "text-[var(--color-success)]" : trade.result_r < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"
              }`}
            >
              {formatR(trade.result_r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true })}
            </div>
          </div>
          <div className="text-right text-sm text-[var(--color-text-muted)]">
            <div>Entry: {format(new Date(trade.entry_time), "PPp")}</div>
            {trade.end_time && <div>End: {format(new Date(trade.end_time), "PPp")}</div>}
          </div>
        </div>

        {variables.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {variables.map((v) => {
              const val = findVariableValue(v.id);
              if (!val) return null;
              return (
                <div key={v.id} className="rounded-md border border-[var(--color-border)] p-2 text-sm">
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {v.icon} {v.label}
                  </div>
                  <div>{val}</div>
                </div>
              );
            })}
          </div>
        )}

        {trade.notes && (
          <div className="rounded-md border border-[var(--color-border)] p-3 text-sm whitespace-pre-wrap">
            {trade.notes}
          </div>
        )}

        {trade.screenshots && trade.screenshots.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {trade.screenshots.map((s) => (
              <div key={s.id} className="flex h-16 w-16 items-center justify-center rounded-md border border-[var(--color-border)]">
                <ImageIcon className="h-5 w-5 text-[var(--color-text-muted)]" />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="outline"
              disabled={index <= 0}
              onClick={() => onNavigate(trades[index - 1])}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={index >= trades.length - 1}
              onClick={() => onNavigate(trades[index + 1])}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await createTrade.mutateAsync({
                  entry_time: trade.entry_time,
                  end_time: trade.end_time,
                  outcome: trade.outcome,
                  risk_r: trade.risk_r,
                  result_r: trade.result_r,
                  market: trade.market,
                  notes: trade.notes,
                  variableValues: trade.variableValues,
                });
                onClose();
              }}
            >
              <Copy className="h-4 w-4" /> Duplicate
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAddTradeModal(trade.id)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await deleteTrade.mutateAsync(trade.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
