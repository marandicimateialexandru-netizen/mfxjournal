import { useEffect, useRef } from "react";
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

// Fast start, gentle settle — reads as the number "loading in and landing" rather than an
// instant snap (ease-in-out) or a rushed start that goes nowhere at the end (linear).
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  iconTone,
  sub,
  info,
  gauge,
  countTo,
  format,
  countDelay = 0,
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
  /** When set (with `format`), the displayed number animates up from 0 to this value on mount/change instead of showing `value` statically. */
  countTo?: number;
  format?: (n: number) => string;
  /** Stagger the count-up start (ms) so a row of tiles animates in sequence rather than all at once. */
  countDelay?: number;
}) {
  const numberRef = useRef<HTMLDivElement>(null);

  // Fully imperative — refs + a direct rAF loop writing textContent, zero React re-renders per
  // frame — the same pattern AppScoreRadar's ScoreMeter already uses. With up to 7 of these
  // animating at once on dashboard mount, driving each through React state (the old useCountUp
  // hook) meant up to 7 separate render+commit passes competing for the same browser frame; this
  // keeps the whole reveal off React's render cycle entirely, which is what was actually behind
  // the numbers feeling laggy alongside the equity curve.
  useEffect(() => {
    const el = numberRef.current;
    if (!el) return;
    if (countTo == null || !format) {
      el.textContent = value;
      return;
    }
    let raf = 0;
    const duration = 1300;
    function tick(start: number, now: number) {
      const t = Math.min(1, (now - start) / duration);
      el!.textContent = format!(countTo! * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame((n) => tick(start, n));
    }
    const timeout = setTimeout(() => {
      raf = requestAnimationFrame((start) => tick(start, start));
    }, countDelay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
    // format/value deliberately excluded — countTo/countDelay (primitives) are the only things
    // that should ever restart this animation; a formatter fn recreated on an unrelated parent
    // re-render shouldn't yank a number back to 0 mid-animation or replay a finished one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countTo, countDelay]);

  const initialDisplay = countTo != null && format ? format(0) : value;

  const toneClass = {
    neutral: "text-[var(--color-text)]",
    positive: "text-gradient-profit",
    negative: "text-[var(--color-danger)]",
    warning: "text-[var(--color-warning)]",
  }[tone];

  const accentTone = iconTone ?? TONE_TO_ICON_TONE[tone];

  return (
    <Card className="shadow-md shadow-black/10">
      <CardContent className="flex items-center justify-between gap-2 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <IconBadge icon={Icon} tone={accentTone} size={32} className="shrink-0" />}
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold text-[var(--color-text)]">
              {label}
            </span>
            {info && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-[var(--color-text-muted)] opacity-70" />
                </TooltipTrigger>
                <TooltipContent>{info}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div ref={numberRef} className={cn("mt-2.5 truncate text-[28px] font-extrabold leading-none tabular-nums", toneClass)}>
            {initialDisplay}
          </div>
          {sub && <div className="mt-1.5 truncate text-xs text-[var(--color-text-muted)]">{sub}</div>}
        </div>
        {gauge && <div className="shrink-0">{gauge}</div>}
      </CardContent>
    </Card>
  );
}
