import { useState, type ComponentType } from "react";
import { ChevronLeft, ChevronRight, Pencil, Copy, Trash2, X, Calendar, Clock, Maximize2, Minimize2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import { format } from "date-fns";
import { formatR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { useSettings } from "@/features/settings/useSettings";
import { useTradeMutations } from "./useTrades";
import type { Trade } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

const OUTCOME_META: Record<string, { badge: NonNullable<BadgeProps["variant"]>; cssVar: string; label: string }> = {
  win: { badge: "win", cssVar: "--color-success", label: "Win" },
  loss: { badge: "loss", cssVar: "--color-danger", label: "Loss" },
  be: { badge: "be", cssVar: "--color-warning", label: "Break Even" },
};

function outcomeMeta(outcome: string) {
  return OUTCOME_META[outcome] ?? { badge: "default" as const, cssVar: "--color-text-muted", label: outcome };
}

/** Every variable card without its own configured color falls back to this single brand accent
 *  (the same violet used for the "Variables" section dot, the sonar ping, etc.) instead of a
 *  hash-derived rainbow. A hashed-per-variable tone made every card a different color for no real
 *  reason and read as noisy confetti; reserving actual color for values someone deliberately
 *  configured (a Buy/Sell direction picker, say) makes that color mean something again instead of
 *  competing with a dozen arbitrary ones. */
const NEUTRAL_VARIABLE_ACCENT = "#8b5cf6";

function findVariableDisplay(trade: Trade, variable: VariableWithValues) {
  const tagged = trade.variableValues?.[variable.id];
  if (variable.type === "number") {
    if (tagged?.numberValue == null) return null;
    return { color: null as string | null, valueLabel: String(tagged.numberValue) };
  }
  const values = (tagged?.valueIds ?? [])
    .map((id) => variable.values.find((v) => v.id === id))
    .filter((v): v is NonNullable<typeof v> => !!v);
  if (values.length === 0) return null;
  // Multiple tags (Liquidity/News) join into one card rather than needing a second grid layout —
  // the color swatch falls back to the neutral accent once more than one color could apply.
  return {
    color: values.length === 1 ? values[0].color : null,
    valueLabel: values.map((v) => v.label).join(" + "),
  };
}

/** A small "label above value" card used for both Entry/End time and each tagged variable — same
 *  shape everywhere so the grid below reads as one consistent system instead of mismatched cards.
 *  Variable cards mark their identity with a small glowing color dot rather than an icon badge — a
 *  first pass used big saturated gradient emoji bubbles here and it read as a toy/kids-app sticker
 *  sheet once a dozen of them sat packed together in a dense grid; a quiet color-coded dot (the same
 *  "swatch + label" pattern serious tag/label systems use) reads as deliberate and professional at
 *  this density instead. */
function InfoCard({
  icon: Icon,
  accentColor,
  label,
  value,
  sub,
}: {
  icon?: ComponentType<{ className?: string }>;
  accentColor?: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card-glow flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2.5">
      {accentColor ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: accentColor, boxShadow: `0 0 7px color-mix(in srgb, ${accentColor} 75%, transparent)` }}
        />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
      )}
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </div>
        <div className="truncate text-sm font-bold text-[var(--color-text)]">{value}</div>
        {sub && <div className="truncate text-xs text-[var(--color-text-muted)]">{sub}</div>}
      </div>
    </div>
  );
}

export function TradeFullDetailModal({
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
  const [lightbox, setLightbox] = useState<{ path: string; label: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!trade) return null;
  const index = trades.findIndex((t) => t.id === trade.id);
  const calcMode = settings?.calc_mode ?? "r";
  const meta = outcomeMeta(trade.outcome);
  const entryDate = new Date(trade.entry_time);
  const endDate = trade.end_time ? new Date(trade.end_time) : null;

  function handleEdit() {
    onClose();
    openAddTradeModal(trade!.id);
  }

  return (
    <Dialog open={!!trade} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        hideClose
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 transition-[max-width,height] duration-200",
          expanded ? "h-[92vh] max-w-[95vw]" : "max-h-[90vh] max-w-2xl",
        )}
        style={{
          borderColor: `color-mix(in srgb, var(${meta.cssVar}) 35%, var(--color-border))`,
          boxShadow: `0 25px 70px -20px rgba(0,0,0,0.7), 0 0 70px -24px color-mix(in srgb, var(${meta.cssVar}) 55%, transparent)`,
        }}
      >
        {/* Outcome-colored accent bar — same "gradient top strip" language every other card in the
            app uses, just tinted per-outcome instead of a fixed tone. */}
        <div
          className="h-1 shrink-0"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, var(${meta.cssVar}) 85%, white), var(${meta.cssVar}))`,
          }}
        />

        {/* Outer chrome: market/outcome/date on the left, trade-to-trade navigation, expand, and
            close on the right — browsing controls, kept separate from the card's own actions below. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="outline" className="shrink-0 font-bold">
              {trade.market ?? "—"}
            </Badge>
            <Badge variant={meta.badge} className="shrink-0 font-bold uppercase">
              {meta.label}
            </Badge>
            <span className="truncate text-sm text-[var(--color-text-muted)]">
              {format(entryDate, "MMM d, yyyy 'at' HH:mm")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button size="icon" variant="ghost" disabled={index <= 0} onClick={() => onNavigate(trades[index - 1])}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-1 text-xs tabular-nums text-[var(--color-text-muted)]">
              {index + 1}/{trades.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              disabled={index >= trades.length - 1}
              onClick={() => onNavigate(trades[index + 1])}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {/* The card's own header — its identity repeated (matches this being a self-contained
              "trade card"), paired with the actions that operate on THIS trade specifically. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-bold">
                {trade.market ?? "—"}
              </Badge>
              <Badge variant={meta.badge} className="font-bold uppercase">
                {meta.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="icon"
                variant="ghost"
                title="Duplicate"
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
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Delete"
                className="hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                onClick={async () => {
                  await deleteTrade.mutateAsync(trade.id);
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
          </div>

          {/* The headline number — a soft outcome-tinted glow behind it instead of a flat box, so
              it reads as the one thing this whole card is built around. */}
          <div
            className="relative overflow-hidden rounded-xl border p-6 text-center"
            style={{
              borderColor: `color-mix(in srgb, var(${meta.cssVar}) 40%, transparent)`,
              background: `radial-gradient(ellipse 80% 100% at 50% 0%, color-mix(in srgb, var(${meta.cssVar}) 16%, transparent), transparent 70%)`,
              boxShadow: `0 0 36px -14px color-mix(in srgb, var(${meta.cssVar}) 60%, transparent)`,
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Result
            </div>
            <div className="mt-1 text-4xl font-extrabold tabular-nums" style={{ color: `var(${meta.cssVar})` }}>
              {formatR(trade.result_r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, {
                showSign: true,
              })}
            </div>
          </div>

          <div className={cn("grid gap-3", endDate ? "grid-cols-2" : "grid-cols-1")}>
            <InfoCard icon={Calendar} label="Entry Time" value={format(entryDate, "d MMM yyyy")} sub={format(entryDate, "HH:mm")} />
            {endDate && <InfoCard icon={Clock} label="End Time" value={format(endDate, "d MMM yyyy")} sub={format(endDate, "HH:mm")} />}
          </div>

          {variables.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" />
                Variables
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {variables.map((v) => {
                  const display = findVariableDisplay(trade!, v);
                  if (!display) return null;
                  return (
                    <InfoCard
                      key={v.id}
                      accentColor={display.color ?? NEUTRAL_VARIABLE_ACCENT}
                      label={v.label}
                      value={display.valueLabel}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {trade.notes && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Notes
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm whitespace-pre-wrap text-[var(--color-text)]">
                {trade.notes}
              </div>
            </div>
          )}

          {trade.screenshots && trade.screenshots.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <span>Screenshots</span>
                <span className="normal-case text-[var(--color-text-muted)]/70">Click to view</span>
              </div>
              {/* A compact gallery grid instead of one full-width image per row — a trade with
                  several screenshots used to stack into a wall of 380px-tall blocks that made the
                  whole card feel bloated and "stretched"; fixed aspect-ratio tiles stay a
                  predictable size regardless of how many screenshots a trade has. */}
              <div className={cn("grid gap-2.5", trade.screenshots.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {trade.screenshots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setLightbox({ path: s.file_path, label: s.label ?? "Screenshot" })}
                    className="group relative block aspect-video w-full overflow-hidden rounded-lg border border-[var(--color-border)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(0,0,0,0.55)]"
                  >
                    <img
                      src={convertFileSrc(s.file_path)}
                      alt={s.label ?? "Trade screenshot"}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
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
        </div>

        {lightbox && <ImageLightbox path={lightbox.path} label={lightbox.label} onClose={() => setLightbox(null)} />}
      </DialogContent>
    </Dialog>
  );
}
