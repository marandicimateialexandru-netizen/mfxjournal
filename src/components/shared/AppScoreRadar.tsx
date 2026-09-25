import { useEffect, useId, useMemo, useRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { AppScoreBreakdown } from "@/features/stats/appScore";

/** Ease-in-out: slow start, smooth middle, gentle settle — reads as deliberate rather than abrupt. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** A real card instead of the shared plain-box chart tooltip — the default was a flat, cramped,
 *  near-black square with no room to breathe. A first pass went too big and covered half the other
 *  corners on this small chart; a second pass overcorrected into an almost-unreadable inline chip.
 *  This lands in between: compact but with real, legible type, a small colored dot as a bit of
 *  visual flair, and a glow that reads as "cool" without the box itself being oversized. */
function RadarTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: { label: string; value: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const label = entry.payload?.label ?? "";
  const value = entry.value;
  return (
    <div
      className="whitespace-nowrap rounded-lg border px-3 py-2"
      style={{
        background: "var(--color-surface)",
        borderColor: "rgba(52, 211, 153, 0.4)",
        boxShadow: "0 10px 22px -6px rgba(0,0,0,0.6), 0 0 16px -3px rgba(52,211,153,0.4)",
      }}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#34d399", boxShadow: "0 0 6px #34d399" }} />
        {label}
      </div>
      <div className="mt-0.5 text-lg font-extrabold tabular-nums text-[#34d399]">{value}</div>
    </div>
  );
}

export function AppScoreRadar({ breakdown }: { breakdown: AppScoreBreakdown }) {
  const gradientId = useId();
  const glowId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  // Memoized so this stays a stable reference across re-renders — without it, every render (which
  // used to include 60/sec re-renders from the count-up below, before that was isolated into its
  // own component) handed Recharts a brand-new array and made it redo the whole radar layout for
  // no reason, which was the actual cause of the reported "flicker".
  const data = useMemo(
    () => breakdown.subScores.map((s) => ({ label: s.label, value: Math.round(s.value) })),
    [breakdown],
  );
  const score = Math.round(breakdown.score);

  /** Traces the web's own outline in — like it's being spun, not just grown from the center — with
   *  a small glowing spark riding the exact tip of the reveal. This is the same stroke-dasharray
   *  "draw a line" trick that flickered on the equity curve, but it's safe *here*: Recharts renders
   *  the radar polygon as dead-straight line segments (`M x,y L x,y L x,y ... Z`) in one flat stroke
   *  color, not curved beziers under a shifting multi-stop gradient — those two specific things were
   *  what caused the equity curve's antialiasing flicker, and neither is present on this shape.
   *  The spark's own glow is a CSS box-shadow on a plain HTML div (transform-only per frame, same
   *  technique as the dashboard's hover-dot overlays), not an SVG filter, so it can't reintroduce a
   *  filter-recomputed-every-frame cost either. The one SVG glow filter here is applied to the path
   *  only once, after it's fully drawn and static (see applyGlow) — exactly the "defer the filter
   *  until nothing is animating anymore" fix that solved the equity curve's actual jank. */
  useEffect(() => {
    const container = containerRef.current;
    const spark = sparkRef.current;
    if (!container) return;
    let raf = 0;
    let start: number | null = null;
    let finished = false;
    const duration = 1100;
    const startDelay = 100;

    let cachedPath: SVGPathElement | null = null;
    let length = 0;

    function getPath(): SVGPathElement | null {
      if (!cachedPath?.isConnected) {
        cachedPath = container!.querySelector<SVGPathElement>(".recharts-polygon");
        length = cachedPath?.getTotalLength() ?? 0;
      }
      return cachedPath;
    }

    function positionSpark(eased: number) {
      if (!spark || length === 0) return;
      const path = getPath();
      const svg = container!.querySelector(".recharts-wrapper svg");
      if (!path || !svg) return;
      const point = path.getPointAtLength(eased * length);
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container!.getBoundingClientRect();
      const offsetX = svgRect.left - containerRect.left;
      const offsetY = svgRect.top - containerRect.top;
      spark.style.transform = `translate(${offsetX + point.x}px, ${offsetY + point.y}px)`;
    }

    function applyFrame(eased: number) {
      const path = getPath();
      if (!path || length === 0) return false;
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length * (1 - eased));
      if (spark) spark.style.opacity = eased > 0 && eased < 1 ? "1" : "0";
      positionSpark(eased);
      return true;
    }

    // Three strict stages, one after another — carve the outline, then let the green interior glow
    // to life, then light up each corner in turn — instead of everything landing at once.
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function revealFill(animate: boolean) {
      const path = getPath();
      if (!path) return;
      // `animate` is false when this is called from the self-healing MutationObserver below (e.g.
      // Recharts rebuilding the chart on a window resize/fullscreen toggle) — that's re-asserting
      // an already-finished state, not a fresh reveal, so it should just snap into place instead of
      // replaying the fade-in every time the window resizes.
      path.style.transition = animate ? "fill-opacity 550ms ease-out" : "none";
      path.style.fillOpacity = "1";
    }

    function revealDotsCascade() {
      const dots = Array.from(container!.querySelectorAll<SVGElement>(".recharts-radar-dot"));
      const stagger = 110;
      const popDuration = 400;
      dots.forEach((el, i) => {
        timeouts.push(
          setTimeout(() => {
            // A gentle scale-in with a small settle at the end, plus a brief neon glow that rides
            // along with it — a plain CSS `filter: drop-shadow(...)` (not an SVG <feDropShadow>
            // element), applied here to an already-landed, non-resizing dot, so nothing about it
            // costs anything per animation frame.
            el.style.opacity = "1";
            el.style.filter = "drop-shadow(0 0 5px #6ee7b7) drop-shadow(0 0 9px rgba(110,231,183,0.55))";
            el.style.animation = "dotPopIn 400ms ease-out both";
          }, i * stagger),
        );
      });
      // Once every dot has landed, fade the glow off all of them together, back to plain flat
      // dots — the neon is a one-time flourish for the reveal, not a permanent state.
      const cascadeDone = (dots.length - 1) * stagger + popDuration;
      timeouts.push(
        setTimeout(() => {
          dots.forEach((el) => {
            el.style.transition = "filter 600ms ease-out";
            el.style.filter = "none";
          });
        }, cascadeDone + 150),
      );
    }

    function applyGlow() {
      const path = getPath();
      if (path) path.style.filter = `url(#${glowId})`;
    }

    function tick(now: number) {
      // ResponsiveContainer measures itself via ResizeObserver before the real chart renders, so
      // the polygon may not exist on the very first frames — don't start the clock until it does.
      if (!getPath()) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (start == null) start = now;
      const elapsed = Math.max(0, now - start - startDelay);
      const t = Math.min(1, elapsed / duration);
      applyFrame(easeInOutCubic(t));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finished = true;
        applyGlow();
        revealFill(true);
        // Dots wait until the fill has had a moment to actually register as green before the
        // corners start lighting up — otherwise it reads as simultaneous, not sequenced.
        timeouts.push(setTimeout(revealDotsCascade, 350));
      }
    }
    raf = requestAnimationFrame(tick);

    // Same self-healing pattern as the equity curve: if Recharts ever swaps the path node after the
    // reveal has finished, re-apply the finished state instead of leaving it stuck fully hidden.
    const observer = new MutationObserver(() => {
      if (!finished) return;
      const path = getPath();
      if (path && path.style.strokeDashoffset !== "0") applyFrame(1);
      applyGlow();
      revealFill(false);
      container!.querySelectorAll<SVGElement>(".recharts-radar-dot").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
        el.style.filter = "none";
      });
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      timeouts.forEach(clearTimeout);
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Pop-in is scoped to just the radar "web" — the score number/meter below get their own
          count-up/travel animation instead, so they shouldn't also scale-pop with the web. */}
      <div ref={containerRef} className="app-score-radar relative h-56 animate-radar-pop">
        {/* A decorative "sonar ping" ring expanding from center, timed to land right as the web
            finishes drawing itself in — plays once (see the CSS), no loop, purely transform/opacity. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[65%] w-[65%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#34d399] animate-radar-ping"
          style={{ boxShadow: "0 0 24px 4px rgba(52,211,153,0.35)" }}
        />
        {/* The spark riding the tip of the web's outline as it draws itself in. */}
        <div
          ref={sparkRef}
          className="pointer-events-none absolute left-0 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
          style={{ background: "#6ee7b7", boxShadow: "0 0 10px 3px rgba(52,211,153,0.9)", willChange: "transform" }}
        />
        {/* Scoped via the wrapper div, not a className handed to <Radar> — whether Recharts forwards
            an arbitrary className down to its internal <path> isn't guaranteed, but this container
            is ours, so descendant selectors off it always resolve correctly. */}
        <style>{`
          .app-score-radar .recharts-polygon {
            stroke-dasharray: 1000;
            stroke-dashoffset: 1000;
            fill-opacity: 0;
          }
          .app-score-radar .recharts-radar-dot {
            opacity: 0;
            transform: scale(0);
            transform-box: fill-box;
            transform-origin: center;
          }
          /* A simple, calm pop for each corner dot — grows in and settles with a small overshoot,
             no color flash, no glow. */
          @keyframes dotPopIn {
            0% {
              transform: scale(0);
            }
            70% {
              transform: scale(1.15);
            }
            100% {
              transform: scale(1);
            }
          }
        `}</style>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <defs>
              <radialGradient id={gradientId}>
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.15} />
              </radialGradient>
              <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#34d399" floodOpacity="0.65" />
              </filter>
            </defs>
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 600, fill: "var(--color-text)" }} />
            {/* offset pushes it a bit clear of the point you're hovering instead of sitting right on
                top of it. allowEscapeViewBox lets it actually reposition freely near the small
                chart's edges rather than being force-clamped inside a 224px box, which is what made
                the placement feel awkward — it can now sit just outside the plotted area when a
                corner is near the edge instead of getting squashed back on top of the data. */}
            <Tooltip
              content={<RadarTooltipContent />}
              offset={18}
              cursor={false}
              allowEscapeViewBox={{ x: true, y: true }}
            />
            <Radar
              dataKey="value"
              stroke="#10b981"
              fill={`url(#${gradientId})`}
              strokeWidth={2.5}
              // Recharts' own entrance animation is off — the custom stroke-dasharray trace above
              // (plus the traveling spark) is the entrance instead, a much more deliberate "the web
              // is being spun" effect than a uniform grow-from-center.
              isAnimationActive={false}
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
    // The last value paint() actually drew — kept so the resize handler below can redraw at the
    // *current* position instead of only updating barWidth for some future frame that may never
    // come (the rAF loop stops for good once the entrance animation finishes).
    let latestValue = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width == null || width === barWidth) return;
      barWidth = width;
      // Without this, a width change that happens *after* the one-shot entrance animation has
      // already finished (window resize, sidebar toggle, the OS restoring a saved window size a
      // moment after launch, etc.) left the dot's pixel offset stale against the new track width —
      // it would drift toward the wrong end and visually land on the wrong color of the gradient
      // underneath it, exactly like a dot that's "off" from both its true position and its color.
      paint(latestValue);
    });
    resizeObserver.observe(bar);

    function paint(value: number) {
      latestValue = value;
      const pct = Math.max(0, Math.min(100, value));
      const color = scoreColor(pct);
      const x = (pct / 100) * barWidth - 8;
      dot.style.transform = `translate(${x}px, -50%)`;
      dot.style.background = color;
      // Also set `color` (not just `background`) so the pulse-ring child, which uses
      // `currentColor`, always matches the dot's live color instead of inheriting the page default.
      dot.style.color = color;
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
        <span
          ref={numberRef}
          className="min-w-[2.5ch] text-right text-2xl font-extrabold tabular-nums"
        >
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
        >
          {/* A single pulse ring once the dot lands (see animation-delay matching the meter's
              1300ms travel time) — a child of the dot, so it rides along with the same transform
              instead of needing its own position tracking. */}
          <span
            className="pointer-events-none absolute inset-0 rounded-full animate-dot-pulse"
            style={{ background: "currentColor" }}
          />
        </div>
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
