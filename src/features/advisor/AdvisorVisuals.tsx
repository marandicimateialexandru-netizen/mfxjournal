import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdvisorTone = "violet" | "positive" | "negative" | "neutral";

const TONE_COLOR: Record<AdvisorTone, string> = {
  violet: "#8b5cf6",
  positive: "#34d399",
  negative: "#f87171",
  neutral: "#8b5cf6",
};

/** A shared icon-badge header for every chart card on the Advisor page — replaces the old plain
 *  muted-text `<CardTitle>` with a colored icon badge, a real title, and an optional description, so
 *  the page reads as a set of distinct instruments rather than a stack of identical grey headers. */
export function AdvisorSectionHeader({
  icon: Icon,
  title,
  description,
  tone = "violet",
  right,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: AdvisorTone;
  right?: ReactNode;
}) {
  const color = TONE_COLOR[tone];
  return (
    <div className="flex flex-row items-center justify-between gap-3 space-y-0">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
          {description && <div className="text-xs text-[var(--color-text-muted)]">{description}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** The Advisor page's headline metric card — replaces the plain `StatTile` grid with an icon badge,
 *  a decorative corner glow (a radial gradient, not a `filter: blur()` — see the sidebar/AI-assistant
 *  precedent for why blur is avoided here), and a caption slot for short context under the number. */
export function AdvisorMetricCard({
  icon: Icon,
  label,
  value,
  tone = "violet",
  caption,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: AdvisorTone;
  caption?: string;
}) {
  const color = TONE_COLOR[tone];
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset" }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <div className="relative flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      </div>
      <div className={cn("relative mt-2 text-2xl font-extrabold tabular-nums")} style={{ color }}>
        {value}
      </div>
      {caption && <div className="relative mt-0.5 text-[11px] text-[var(--color-text-muted)]">{caption}</div>}
    </div>
  );
}
