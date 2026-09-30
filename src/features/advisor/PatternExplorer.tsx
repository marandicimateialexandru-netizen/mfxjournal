import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Tag, Flame, TrendingUp, TrendingDown, Scale, Lightbulb, AlertTriangle, Info, Sparkles } from "lucide-react";
import type { DetectedPattern, PatternSentiment } from "@/features/patterns/detectedPatterns";

const CATEGORY_ICON: Record<string, typeof CalendarDays> = {
  "day-of-week": CalendarDays,
  variable: Tag,
  streak: Flame,
  recent: TrendingUp,
  "risk-reward": Scale,
};

const CATEGORY_LABEL: Record<string, string> = {
  "day-of-week": "Day of Week",
  variable: "Tagged Variable",
  streak: "Streak Momentum",
  recent: "Recent Form",
  "risk-reward": "Risk / Reward",
};

const SENTIMENT_META: Record<PatternSentiment, { label: string; color: string; icon: typeof TrendingUp }> = {
  positive: { label: "Opportunity", color: "#34d399", icon: TrendingUp },
  negative: { label: "Needs Attention", color: "#f87171", icon: AlertTriangle },
  neutral: { label: "Insight", color: "#8b5cf6", icon: Info },
};

/** A step-through "one pattern at a time" explorer instead of a flat bulleted list — each detected
 *  pattern (see `detectedPatterns.ts`, which now attaches a sentiment and a concrete tip at the
 *  source) gets its own focused card with a sentiment badge and an actionable tip callout, and the
 *  dot rail below doubles as an at-a-glance "how many wins vs leaks" overview via its own coloring. */
export function PatternExplorer({ patterns }: { patterns: DetectedPattern[] }) {
  const [index, setIndex] = useState(0);

  if (patterns.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Not enough data yet.</p>;
  }

  const clampedIndex = Math.min(index, patterns.length - 1);
  const pattern = patterns[clampedIndex];
  const meta = SENTIMENT_META[pattern.sentiment];
  const CategoryIcon = CATEGORY_ICON[pattern.category] ?? Sparkles;
  const SentimentIcon = pattern.category === "recent" && pattern.sentiment === "negative" ? TrendingDown : meta.icon;

  function go(delta: number) {
    setIndex((i) => (i + delta + patterns.length) % patterns.length);
  }

  return (
    <div
      className="space-y-3 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
    >
      <div
        key={clampedIndex}
        className="animate-pattern-card-in relative overflow-hidden rounded-xl border p-5"
        style={{ borderColor: `color-mix(in srgb, ${meta.color} 35%, var(--color-border))`, background: `color-mix(in srgb, ${meta.color} 6%, var(--color-background))` }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${meta.color}, transparent 70%)` }}
        />

        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            <CategoryIcon className="h-3.5 w-3.5" />
            {CATEGORY_LABEL[pattern.category] ?? pattern.category}
          </div>
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 16%, transparent)` }}
          >
            <SentimentIcon className="h-3 w-3" /> {meta.label}
          </div>
        </div>

        <p className="relative mt-3 text-base leading-relaxed text-[var(--color-text)]">{pattern.text}</p>

        <div className="relative mt-4 flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-sm text-[var(--color-text)]">{pattern.tip}</p>
        </div>

        {pattern.lowConfidence && (
          <p className="relative mt-2 text-[11px] text-[var(--color-text-muted)] opacity-70">
            Small sample — treat this as a lead worth watching, not a settled conclusion yet.
          </p>
        )}
      </div>

      {patterns.length > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => go(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-all hover:border-[#8b5cf6]/50 hover:text-[var(--color-text)]"
            aria-label="Previous pattern"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {patterns.map((p, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to pattern ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === clampedIndex ? "18px" : "6px",
                  background: i === clampedIndex ? SENTIMENT_META[p.sentiment].color : "var(--color-border)",
                }}
              />
            ))}
          </div>

          <button
            onClick={() => go(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-all hover:border-[#8b5cf6]/50 hover:text-[var(--color-text)]"
            aria-label="Next pattern"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <p className="text-center text-[11px] text-[var(--color-text-muted)] opacity-60">
        {clampedIndex + 1} of {patterns.length} patterns detected
      </p>
    </div>
  );
}
