import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Copy, Trash2, X } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
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
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!trade) return null;
  const index = trades.findIndex((t) => t.id === trade.id);
  const calcMode = settings?.calc_mode ?? "r";

  function findVariableValue(variableId: string) {
    const variable = variables.find((v) => v.id === variableId);
    if (!variable) return null;
    const tagged = trade!.variableValues?.[variableId];
    if (variable.type === "number") return tagged?.numberValue != null ? String(tagged.numberValue) : null;
    const values = (tagged?.valueIds ?? []).map((id) => variable.values.find((v) => v.id === id)).filter((v): v is NonNullable<typeof v> => !!v);
    if (values.length === 0) return null;
    return values.map((v) => `${v.icon ?? ""} ${v.label}`).join(" + ");
  }

  return (
    <Dialog open={!!trade} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={trade.screenshots && trade.screenshots.length > 0 ? "max-w-[52rem]" : "max-w-xl"}>
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--color-text-muted)]">
              <span>Screenshots</span>
              <span>Click to zoom in</span>
            </div>
            <div className="space-y-2">
              {trade.screenshots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setLightbox(convertFileSrc(s.file_path))}
                  className="relative block h-[380px] w-full overflow-hidden rounded-lg border border-[var(--color-border)] shadow-sm transition-opacity hover:opacity-90"
                >
                  <img
                    src={convertFileSrc(s.file_path)}
                    alt={s.label ?? "Trade screenshot"}
                    className="h-full w-full object-cover"
                  />
                  {s.label && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      {s.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {lightbox && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-8"
            onClick={() => setLightbox(null)}
          >
            <img src={lightbox} alt="Trade screenshot" className="max-h-full max-w-full rounded-lg object-contain" />
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-6 top-6 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            >
              <X className="h-5 w-5" />
            </button>
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
