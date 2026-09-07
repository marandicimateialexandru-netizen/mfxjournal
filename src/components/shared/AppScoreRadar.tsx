import { useEffect, useId, useMemo, useRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { AppScoreBreakdown } from "@/features/stats/appScore";
import { tooltipContentStyle, tooltipLabelStyle } from "@/lib/chartTheme";

export function AppScoreRadar({ breakdown }: { breakdown: AppScoreBreakdown }) {
  const gradientId = useId();
  // Memoized so this stays a stable reference across re-renders — without it, every render (which
  // used to include 60/sec re-renders from the count-up below, before that was isolated into its
  // own component) handed Recharts a brand-new array and made it redo the whole radar layout for
  // no reason, which was the actual cause of the reported "flicker".
  const data = useMemo(
    () => breakdown.subScores.map((s) => ({ label: s.label, value: Math.round(s.value) })),
    [breakdown],
  );
  const score = Math.round(breakdown.score);

  return (
    <div className="space-y-4">
      {/* Pop-in is scoped to just the radar "web" — the score number/meter below get their own
          count-up/travel animation instead, so they shouldn't also scale-pop with the web. */}
      <div className="h-56 animate-radar-pop">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <defs>
              <radialGradient id={gradientId}>
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.15} />
              </radialGradient>
            </defs>
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 600, fill: "var(--color-text)" }} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={{ color: "var(--color-text)", fontWeight: 600 }}
              cursor={false}
            />
            <Radar
              dataKey="value"
              stroke="#10b981"
              fill={`url(#${gradientId})`}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "#10b981", stroke: "var(--color-surface)", strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: "#34d399", stroke: "var(--color-surface)", strokeWidth: 2 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <ScoreMeter score={score} />
    </div>
  );
}

/** Ease-in-out: slow start, smooth middle, gentle settle — reads as deliberate rather than abrupt. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Fully imperative: driven by refs and a single rAF loop, with zero React re-renders during the
 *  animation. Every per-frame mutation is limited to `transform` and flat `background`/`color`
 *  changes on small elements — the two guaranteed-compositor-only properties, plus a color swap
 *  cheap enough (tiny invalidated area) not to matter. */
function ScoreMeter({ score }: { score: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const barEl = barRef.current;
    const dotEl = dotRef.current;
    const numberEl = numberRef.current;
    if (!barEl || !dotEl || !numberEl) return;
    // Reassigned to non-null-typed consts — the nested function declarations below don't retain
    // TS's narrowing from the guard above since they're captured by reference, not used inline.
    const bar: HTMLDivElement = barEl;
    const dot: HTMLDivElement = dotEl;
    const number: HTMLSpanElement = numberEl;

    let barWidth = bar.getBoundingClientRect().width;
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width != null) barWidth = width;
    });
    resizeObserver.observe(bar);

    function paint(value: number) {
      const pct = Math.max(0, Math.min(100, value));
      const color = scoreColor(pct);
      const x = (pct / 100) * barWidth - 8;
      dot.style.transform = `translate(${x}px, -50%)`;
      dot.style.background = color;
      number.textContent = String(Math.round(pct));
      number.style.color = color;
    }

    const duration = 1300;
    let raf = 0;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      paint(score * easeInOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [score]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-[var(--color-text-muted)]">App Score</span>
        <span ref={numberRef} className="min-w-[2.5ch] text-right text-2xl font-extrabold tabular-nums">
          0
        </span>
      </div>
      {/* Outer wrapper is as tall as the dot (16px), not the thinner 10px bar, so the dot — a
          sibling, not a child of the bar below — never gets clipped by it. */}
      <div className="relative h-4">
        <div ref={barRef} className="absolute top-1/2 left-0 h-2.5 w-full -translate-y-1/2 rounded-full" style={{ background: SCORE_GRADIENT }} />
        <div
          ref={dotRef}
          className="absolute top-1/2 left-0 h-4 w-4 rounded-full border-2 border-white shadow-md"
          style={{ transform: "translate(-8px, -50%)", background: scoreColor(0), willChange: "transform" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

const SCORE_GRADIENT =
  "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #84cc16, #34d399)";

/** Same 5 stops as SCORE_GRADIENT, evenly spaced (linear-gradient's default when no
 *  explicit stop positions are given) — kept in sync so the handle/number can sample
 *  the exact color the meter shows at that position, not just a bucketed approximation. */
const SCORE_STOPS: { pos: number; rgb: [number, number, number] }[] = [
  { pos: 0, rgb: [239, 68, 68] },
  { pos: 25, rgb: [245, 158, 11] },
  { pos: 50, rgb: [234, 179, 8] },
  { pos: 75, rgb: [132, 204, 22] },
  { pos: 100, rgb: [52, 211, 153] },
];

function scoreColor(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  let lower = SCORE_STOPS[0];
  let upper = SCORE_STOPS[SCORE_STOPS.length - 1];
  for (let i = 0; i < SCORE_STOPS.length - 1; i++) {
    if (clamped >= SCORE_STOPS[i].pos && clamped <= SCORE_STOPS[i + 1].pos) {
      lower = SCORE_STOPS[i];
      upper = SCORE_STOPS[i + 1];
      break;
    }
  }
  const range = upper.pos - lower.pos;
  const t = range === 0 ? 0 : (clamped - lower.pos) / range;
  const r = Math.round(lower.rgb[0] + (upper.rgb[0] - lower.rgb[0]) * t);
  const g = Math.round(lower.rgb[1] + (upper.rgb[1] - lower.rgb[1]) * t);
  const b = Math.round(lower.rgb[2] + (upper.rgb[2] - lower.rgb[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
