import { useMemo, useState } from "react";
import { ArrowUpDown, Trophy, Tag } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WinRateBar } from "@/components/shared/WinRateBar";
import { IconBadge, toneForKey, type IconComponent, type IconTone } from "@/components/shared/IconBadge";
import { formatPct } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import type { VariableBucketStats } from "@/features/stats/types";

type SortMode = "default" | "winRate" | "beRate" | "trades";

const SORT_LABELS: Record<SortMode, string> = {
  default: "Default",
  winRate: "Win Rate",
  beRate: "BE Rate",
  trades: "Trades",
};

const MAX_VISIBLE = 5;

function sortBuckets(buckets: VariableBucketStats[], mode: SortMode, configuredOrder: string[]): VariableBucketStats[] {
  if (mode === "winRate") return [...buckets].sort((a, b) => b.winRatePct - a.winRatePct || b.tradeCount - a.tradeCount);
  if (mode === "beRate") return [...buckets].sort((a, b) => b.beRatePct - a.beRatePct || b.tradeCount - a.tradeCount);
  if (mode === "trades") return [...buckets].sort((a, b) => b.tradeCount - a.tradeCount);

  // "Default Order": trade count descending, ties broken by the variable's own configured value order —
  // deliberately NOT a passthrough of configured order.
  const orderIndex = new Map(configuredOrder.map((id, i) => [id, i]));
  return [...buckets].sort((a, b) => {
    if (b.tradeCount !== a.tradeCount) return b.tradeCount - a.tradeCount;
    const ai = orderIndex.get(a.valueId) ?? Number.MAX_SAFE_INTEGER;
    const bi = orderIndex.get(b.valueId) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

export function WinRateCard({
  dimensionLabel,
  dimensionKey,
  buckets,
  configuredOrder,
  sortable = true,
  icon,
  emoji,
  tone,
}: {
  dimensionLabel: string;
  /** Stable id used only as a fallback color seed when `tone` isn't given — doesn't affect data. */
  dimensionKey: string;
  buckets: VariableBucketStats[];
  /** valueIds in the variable's configured display order, used to break Default Order ties (and as the fixed order when sortable is false). */
  configuredOrder: string[];
  /** When false, rows always stay in configuredOrder — no sort control, positions never shift as trades come in (e.g. Days of Week). */
  sortable?: boolean;
  /** Category-specific header icon (e.g. Calendar for Days of Week, Flame for Streak Analysis). Falls back to a generic tag. */
  icon?: IconComponent;
  /** A custom variable's own configured emoji (from the Variables page) — takes priority over `icon` when set. */
  emoji?: string | null;
  /** A deliberate, meaningful badge color for this dimension. Falls back to the hash-based tone when not given. */
  tone?: IconTone;
}) {
  const hideBeRateColor = useUiStore((s) => s.hideBeRateColor);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Every configured value gets a row, even with zero trades — it'll come alive as soon as you log one.
  const sorted = useMemo(() => {
    if (!sortable) {
      const orderIndex = new Map(configuredOrder.map((id, i) => [id, i]));
      return [...buckets].sort((a, b) => (orderIndex.get(a.valueId) ?? 0) - (orderIndex.get(b.valueId) ?? 0));
    }
    return sortBuckets(buckets, sortMode, configuredOrder);
  }, [buckets, sortable, sortMode, configuredOrder]);
  const needsScroll = sorted.length > MAX_VISIBLE;

  const totalTrades = useMemo(() => buckets.reduce((sum, b) => sum + b.tradeCount, 0), [buckets]);
  const topValueId = useMemo(() => {
    const withData = buckets.filter((b) => b.tradeCount > 0);
    if (withData.length === 0) return null;
    return [...withData].sort((a, b) => b.winRatePct - a.winRatePct || b.tradeCount - a.tradeCount)[0].valueId;
  }, [buckets]);

  if (sorted.length === 0) return null;

  return (
    <Card className="transition-shadow hover:shadow-lg hover:shadow-black/5">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex min-w-0 items-center gap-2.5">
          {emoji ? (
            <IconBadge emoji={emoji} tone={tone ?? toneForKey(dimensionKey)} size={30} className="shrink-0" />
          ) : (
            <IconBadge icon={icon ?? Tag} tone={tone ?? toneForKey(dimensionKey)} size={38} className="shrink-0" />
          )}
          <div className="min-w-0">
            <CardTitle className="truncate text-[var(--color-text)]">{dimensionLabel} Win Rates</CardTitle>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              {buckets.length} value{buckets.length === 1 ? "" : "s"} · {totalTrades} trade{totalTrades === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {sortable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-[var(--color-text-muted)]">
                <ArrowUpDown className="h-3.5 w-3.5" /> {SORT_LABELS[sortMode]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <DropdownMenuRadioItem value="default">Default Order</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="winRate">Win Rate</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="beRate">BE Rate</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="trades">Trades</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {needsScroll ? (
          <ScrollArea className="h-[232px] pr-3">
            <div className="space-y-2.5 pb-0.5">
              {sorted.map((b) => (
                <WinRateRow key={b.valueId} bucket={b} isTop={b.valueId === topValueId} hideBeRateColor={hideBeRateColor} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-2.5">
            {sorted.map((b) => (
              <WinRateRow key={b.valueId} bucket={b} isTop={b.valueId === topValueId} hideBeRateColor={hideBeRateColor} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-2.5 text-[11px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" /> Win
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-warning)]/10 px-2 py-0.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-warning)]" /> BE
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function WinRateRow({
  bucket: b,
  isTop,
  hideBeRateColor,
}: {
  bucket: VariableBucketStats;
  isTop: boolean;
  hideBeRateColor: boolean;
}) {
  const hasData = b.tradeCount > 0;
  const bePct = hideBeRateColor ? 0 : b.beRatePct;
  return (
    <div
      className={cn(
        "-mx-1.5 space-y-1 rounded-md px-1.5 py-1 transition-colors",
        "hover:bg-[var(--color-background)]",
        !hasData && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[var(--color-text)]">
          {isTop && <Trophy className="h-3 w-3 shrink-0 text-[var(--color-warning)]" />}
          {b.icon && <span>{b.icon}</span>}
          <span className="truncate">{b.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 tabular-nums">
          <span className="text-[var(--color-text-muted)]">{b.tradeCount} trades</span>
          <span className={cn("font-bold", hasData ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]")}>
            {hasData ? formatPct(b.winRatePct) : "—"}
          </span>
          {hasData && bePct > 0 && <span className="font-bold text-[var(--color-warning)]">{formatPct(bePct)}</span>}
        </span>
      </div>
      <WinRateBar winPct={b.winRatePct} bePct={bePct} />
    </div>
  );
}
