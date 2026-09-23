import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { IconBadge, type IconTone } from "./IconBadge";
import { RadialGauge } from "./RadialGauge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { StreakState } from "@/features/stats/types";

/** One half of the tile: a small ring showing the current streak length (capped at 10 for the
 *  ring's fill so a streak of 1-2 doesn't read as "broken"), plus the all-time win/loss pill
 *  counts for that dimension underneath — same pill language as ArcGauge elsewhere on the page. */
function StreakColumn({ caption, streak, wins, losses }: { caption: string; streak: StreakState; wins: number; losses: number }) {
  const isWin = streak.type === "win";
  const isLoss = streak.type === "loss";
  const gradient: [string, string] = isWin ? ["#34d399", "#059669"] : isLoss ? ["#f87171", "#dc2626"] : ["#8e86ad", "#6b6485"];

  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{caption}</span>
      <RadialGauge value={Math.min(10, streak.count)} max={10} size={56} strokeWidth={6} gradient={gradient} />
      <div className="flex items-center gap-1.5 text-[10px] font-bold tabular-nums">
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-success)]/15 px-1.5 py-0.5 text-[var(--color-success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
          {wins}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-danger)]/15 px-1.5 py-0.5 text-[var(--color-danger)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-danger)]" />
          {losses}
        </span>
      </div>
    </div>
  );
}

export function StreakTile({
  label,
  icon: Icon,
  iconTone,
  info,
  days,
  trades,
}: {
  label: string;
  icon?: LucideIcon;
  iconTone: IconTone;
  info?: string;
  days: { streak: StreakState; wins: number; losses: number };
  trades: { streak: StreakState; wins: number; losses: number };
}) {
  return (
    <Card className="shadow-md shadow-black/10">
      <CardContent className="p-5">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <IconBadge icon={Icon} tone={iconTone} size={32} className="shrink-0" />}
          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold text-[var(--color-text)]">{label}</span>
          {info && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-[var(--color-text-muted)] opacity-70" />
              </TooltipTrigger>
              <TooltipContent>{info}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="mt-3 flex items-start gap-2">
          <StreakColumn caption="Days" streak={days.streak} wins={days.wins} losses={days.losses} />
          <div className="mt-6 h-12 w-px shrink-0 bg-[var(--color-border)]" />
          <StreakColumn caption="Trades" streak={trades.streak} wins={trades.wins} losses={trades.losses} />
        </div>
      </CardContent>
    </Card>
  );
}
