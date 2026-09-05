import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IconBadge, type IconTone } from "./IconBadge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const TONE_TO_ICON_TONE: Record<string, IconTone> = {
  neutral: "violet",
  positive: "green",
  negative: "red",
  warning: "amber",
};

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  iconTone,
  sub,
  info,
  gauge,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "neutral" | "positive" | "negative" | "warning";
  iconTone?: IconTone;
  sub?: React.ReactNode;
  info?: string;
  /** Optional gauge visual rendered on the right side of the tile (arc/ring gauges). */
  gauge?: React.ReactNode;
}) {
  const [animKey, setAnimKey] = useState(0);
  const prevValue = useRef(value);
  useEffect(() => {
    if (prevValue.current !== value) {
      setAnimKey((k) => k + 1);
      prevValue.current = value;
    }
  }, [value]);

  const toneClass = {
    neutral: "text-[var(--color-text)]",
    positive: "text-gradient-profit",
    negative: "text-[var(--color-danger)]",
    warning: "text-[var(--color-warning)]",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <IconBadge icon={Icon} tone={iconTone ?? TONE_TO_ICON_TONE[tone]} size={28} className="shrink-0" />}
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-xs font-medium text-[var(--color-text-muted)]">
              {label}
            </span>
            {info && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 shrink-0 cursor-help opacity-70" />
                </TooltipTrigger>
                <TooltipContent>{info}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div key={animKey} className={cn("mt-2 truncate text-2xl font-bold tabular-nums animate-count-up", toneClass)}>
            {value}
          </div>
          {sub && <div className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{sub}</div>}
        </div>
        {gauge && <div className="shrink-0">{gauge}</div>}
      </CardContent>
    </Card>
  );
}
