import { useMemo } from "react";
import { Tag, CalendarDays, Clock, CandlestickChart, Flame } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { WinRateCard } from "@/components/shared/WinRateCard";
import type { IconComponent, IconTone } from "@/components/shared/IconBadge";
import { getTradingIcon } from "@/components/shared/tradingIcons";
import { useStats } from "@/features/stats/useStats";
import { useMarkets, useStreakThresholds } from "@/features/variables/useAuxLists";
import { dayOfWeekBuckets, timeOfDayBuckets, marketBuckets, streakBuckets } from "@/features/stats/pseudoVariables";

/** Monday through Friday, in that order (JS getDay(): 0=Sunday...6=Saturday) — weekends are excluded, not shown at 0%. */
const WEEKDAY_IDS = ["1", "2", "3", "4", "5"];

interface Dimension {
  key: string;
  label: string;
  buckets: ReturnType<typeof dayOfWeekBuckets>;
  configuredOrder: string[];
  /** false = rows always stay in configuredOrder, never reshuffled by trade count/win rate. */
  sortable?: boolean;
  /** Category-specific header icon. Custom variables auto-match a hand-drawn trading icon by keyword (see `emoji` for the fallback). */
  icon?: IconComponent;
  emoji?: string | null;
  /** A deliberate, meaningful badge color — set per dimension rather than left to the hash-random default. */
  tone?: IconTone;
}

export function VariablesSection() {
  const { stats, variables, customResults, settings } = useStats();
  const { data: markets = [] } = useMarkets();
  const { data: streakThresholds = [] } = useStreakThresholds();

  const dimensions = useMemo<Dimension[]>(() => {
    const trades = stats.filteredTrades;
    const allDayBuckets = dayOfWeekBuckets(trades, customResults);
    const list: Dimension[] = [
      {
        key: "days_of_week",
        label: "Days of Week",
        // Trading days only, Monday through Friday — weekends are excluded rather than shown at 0%.
        buckets: WEEKDAY_IDS.map((id) => allDayBuckets[Number(id)]),
        configuredOrder: WEEKDAY_IDS,
        // Calendar order is the point here — a Tuesday win shouldn't jump Tuesday to the top of the card.
        sortable: false,
        icon: CalendarDays,
        tone: "violet",
      },
      {
        key: "time_of_day",
        label: "Time of Day",
        buckets: timeOfDayBuckets(trades, { windowMinutes: 60, calculateBy: "start" }, customResults),
        configuredOrder: Array.from({ length: 24 }, (_, i) => String(i)),
        icon: Clock,
        tone: "blue",
      },
    ];

    if (markets.length > 0) {
      list.push({
        key: "market",
        label: "Market",
        buckets: marketBuckets(trades, markets, customResults),
        configuredOrder: markets.map((m) => m.symbol),
        icon: CandlestickChart,
        tone: "green",
      });
    }

    if (settings?.streak_analysis_enabled) {
      const sortedThresholds = [...streakThresholds].sort((a, b) => a.threshold - b.threshold);
      const configuredOrder = ["no_streak", "after_be"];
      for (const th of sortedThresholds) {
        configuredOrder.push(`after_win_${th.threshold}`, `after_loss_${th.threshold}`);
      }
      list.push({
        key: "streak_analysis",
        label: "Streak Analysis",
        buckets: streakBuckets(
          trades,
          { thresholds: streakThresholds, beBreaksStreak: !!(settings?.streak_be_breaks_streak ?? 1) },
          customResults,
        ),
        configuredOrder,
        icon: Flame,
        tone: "red",
      });
    }

    for (const v of variables) {
      if (v.type !== "text") continue;
      // Prefer a hand-drawn icon matched to the trading concept (e.g. FVG, MSS, Liquidity), each with its own
      // deliberate color; fall back to whatever emoji is configured on the Variables page, then a plain tag.
      const match = getTradingIcon(v.label) ?? getTradingIcon(v.key);
      list.push({
        key: v.id,
        label: v.label,
        buckets: stats.byVariable[v.id] ?? [],
        configuredOrder: v.values.map((val) => val.id),
        icon: match?.icon,
        emoji: match ? null : v.icon,
        tone: match?.tone,
      });
    }

    return list;
  }, [stats.filteredTrades, stats.byVariable, variables, customResults, markets, streakThresholds, settings]);

  return (
    <CollapsibleSection
      title="Variables"
      subtitle={`${dimensions.length} categor${dimensions.length === 1 ? "y" : "ies"} · every configured value, live`}
      icon={Tag}
      tone="violet"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {dimensions.map((d) => (
          <WinRateCard
            key={d.key}
            dimensionKey={d.key}
            dimensionLabel={d.label}
            buckets={d.buckets}
            configuredOrder={d.configuredOrder}
            sortable={d.sortable}
            icon={d.icon}
            emoji={d.emoji}
            tone={d.tone}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
}
