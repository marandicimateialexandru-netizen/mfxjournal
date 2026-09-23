import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IconBadge, TONE_GRADIENTS, type IconComponent, type IconTone } from "./IconBadge";

/** The shared "cooler" dashboard card chrome: a tone-gradient top accent bar, an IconBadge +
 *  title/subtitle header, solid opaque surface, and a resting shadow — the same visual language
 *  established for the New Trade modal's SectionCard, reused everywhere on the dashboard so every
 *  panel (equity curve, app score, donut, P&L charts, calendar, variable charts) reads as one
 *  coherent, professional system instead of a grab-bag of plain Cards. */
export function AccentCard({
  tone,
  icon,
  emoji,
  title,
  subtitle,
  headerRight,
  children,
  className,
  contentClassName,
  headerClassName,
}: {
  tone: IconTone;
  icon?: IconComponent;
  emoji?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}) {
  return (
    // Plain block stacking, not a flex column: a flex item with `flex-1` (flex-basis 0%) inside an
    // auto-height flex parent ignores an explicit height utility on that same element — the content
    // div would collapse to 0 height instead of respecting `contentClassName`'s `h-52` etc. Normal
    // block flow has no such trap, and it's all this needs (three stacked divs).
    <Card className={cn("relative shadow-lg shadow-black/20", className)}>
      {/* rounded-t (not overflow-hidden on the whole card) so the bar's corners hug the card's own
          curve without clipping anything below it — chart hover effects (e.g. the donut's growing
          active sector, SVG glow filters) need to be able to bleed slightly past the card edge. */}
      <div className="h-1 rounded-t-lg" style={{ background: TONE_GRADIENTS[tone] }} />
      <div className={cn("flex items-center gap-3 p-4 pb-3", headerClassName)}>
        {(icon || emoji) && <IconBadge icon={icon} emoji={emoji} tone={tone} size={32} />}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[var(--color-text)]">{title}</h3>
          {subtitle && <p className="truncate text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      <div className={cn("px-4 pb-4", contentClassName)}>{children}</div>
    </Card>
  );
}
