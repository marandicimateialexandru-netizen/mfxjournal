import { useMemo, useState } from "react";
import { Tag, Check, X, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { useTrades } from "@/features/trades/useTrades";

/** The shared "which symbol am I looking at" control — one filter, mounted on Dashboard, Report,
 *  Advisor, and Journal, all reading/writing the same `uiStore.symbolFilter`. Picking NASDAQ here
 *  narrows every one of those pages at once (via `useStats()` defaulting to the active symbol); the
 *  Trade Calendar and Custom Combinations deliberately opt out of it at their own call sites, not
 *  here — this component has no opinion about who listens. */
export function SymbolFilterCombobox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const symbolFilter = useUiStore((s) => s.symbolFilter);
  const setSymbolFilter = useUiStore((s) => s.setSymbolFilter);
  const { data: trades = [] } = useTrades();

  const symbolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of trades) {
      if (!t.market) continue;
      counts.set(t.market, (counts.get(t.market) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));
  }, [trades]);

  const filtered = query.trim()
    ? symbolCounts.filter((s) => s.symbol.toLowerCase().includes(query.trim().toLowerCase()))
    : symbolCounts;

  function select(symbol: string | null) {
    setSymbolFilter(symbol);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
            symbolFilter
              ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/10 text-[#8b5cf6]"
              : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] hover:border-[#8b5cf6]/40",
          )}
        >
          <Tag className="h-3.5 w-3.5" />
          {symbolFilter ?? "All Symbols"}
          {symbolFilter ? (
            <X
              className="h-3.5 w-3.5 opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                select(null);
              }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-2" align="start">
        <Input
          autoFocus
          placeholder="Search symbols…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8"
        />
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          <button
            type="button"
            onClick={() => select(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-background)]",
              !symbolFilter && "font-semibold text-[#8b5cf6]",
            )}
          >
            <span>All Symbols (combined)</span>
            {!symbolFilter && <Check className="h-3.5 w-3.5" />}
          </button>
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">No matching symbols.</p>
          )}
          {filtered.map(({ symbol, count }) => {
            const selected = symbolFilter === symbol;
            return (
              <button
                key={symbol}
                type="button"
                onClick={() => select(symbol)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-background)]",
                  selected && "font-semibold text-[#8b5cf6]",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {selected && <Check className="h-3.5 w-3.5" />}
                  {symbol}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{count}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
