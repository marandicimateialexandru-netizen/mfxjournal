import { useEffect, useId, useMemo, useRef } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IconBadge } from "@/components/shared/IconBadge";
import { TrendingUp } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";
import type { EquityPoint } from "@/features/stats/types";

const DASH_LENGTH = 4000;

/** Ease-in-out, not ease-out: an ease-out curve is fast *at the start* by definition — measured,
 *  this one was already 43% visually drawn after only the first 270ms of a 2.6s animation, then
 *  crawled through a long, barely-moving tail. That's exactly what read as "flying" followed by
 *  nothing. Ease-in-out starts slow, moves through the middle, and settles gently — evenly paced
 *  motion throughout instead of a rushed start. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Extracts each data point's actual rendered (x,y) straight from the `d` attribute of the
 *  monotone-curve path Recharts draws — the first pair after "M", then the final (x,y) pair of
 *  every subsequent "C x1,y1 x2,y2 x,y" segment. Reading the real rendered geometry instead of
 *  recomputing scale math ourselves guarantees the overlay below always agrees with what's drawn,
 *  no matter what margins/padding Recharts used internally. */
function parsePathPoints(d: string | null): { x: number; y: number }[] {
  if (!d) return [];
  const nums = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  if (nums.length < 2) return [];
  const points = [{ x: nums[0], y: nums[1] }];
  for (let i = 2; i + 6 <= nums.length; i += 6) {
    points.push({ x: nums[i + 4], y: nums[i + 5] });
  }
  return points;
}

/** Isolated in its own component (rather than living inline in DashboardPage) so the entrance
 *  animation's per-frame work only touches this small chart, not the entire dashboard — driving a
 *  60fps loop from a top-level page component re-renders everything on the page every frame, which
 *  is what made earlier attempts at this animation drop frames and read as "just a pop". */
export function EquityCurveChart({
  equityCurve,
  totalR,
  maxDrawdownR,
}: {
  equityCurve: EquityPoint[];
  totalR: number;
  /** Optional — shown as a small secondary badge next to the total R pill when provided. */
  maxDrawdownR?: number;
}) {
  const equityStrokeId = useId();
  const chartRef = useRef<HTMLDivElement>(null);
  const cursorLineRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const endDotRef = useRef<HTMLDivElement>(null);
  // Same timing as the line draw-in below (150ms start delay, 1900ms duration) so the badge
  // finishes ticking up right as the line finishes drawing itself in — one coordinated reveal.
  const animatedTotalR = useCountUp(totalR, 1900, 150);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipDateRef = useRef<HTMLDivElement>(null);
  const tooltipCumRef = useRef<HTMLSpanElement>(null);
  const tooltipTradeWrapRef = useRef<HTMLDivElement>(null);
  const tooltipTradeRef = useRef<HTMLSpanElement>(null);

  /** Drives the line draw-in + fill fade by mutating the rendered SVG elements' style directly
   *  (found via querySelector, using the class names Recharts always renders — "recharts-area-curve"
   *  for the stroke, "recharts-area-area" for the fill) instead of passing animated values through
   *  as React props on <Area>, which never visibly reached the actual <path>. The element is
   *  re-queried on every single frame (cheap — it's two lookups in a small subtree) rather than
   *  cached, so if Recharts ever swaps the underlying DOM node mid-flight the very next frame just
   *  picks up the new one and keeps going instead of animating a now-detached element. Once the
   *  reveal finishes, a MutationObserver keeps re-applying the fully-drawn end state for as long as
   *  this chart is mounted — the actual bug in the previous version was that a swap happening *after*
   *  the animation had already finished (and the rAF loop had stopped) left the chart permanently
   *  stuck on the CSS starting state (fully hidden) with nothing left running to fix it. */
  useEffect(() => {
    const container = chartRef.current;
    const endDot = endDotRef.current;
    if (!container) return;
    let raf = 0;
    let start: number | null = null;
    let finished = false;
    // A deliberate, full intro (not rushed) — the earlier "laggy" complaint turned out to be real
    // frame drops caused by an SVG drop-shadow filter recomputing on every single frame while the
    // path geometry changed underneath it (see the deferred-filter fix below), not the duration
    // itself. With that actual cost removed, the animation can afford to take its time again.
    const duration = 1900;
    const startDelay = 150;

    // Queried once and reused for the life of this tick loop instead of every single frame — the
    // original per-frame re-query was defensive against Recharts swapping the path node mid-flight,
    // but that only actually happens on prop changes (which re-runs this whole effect anyway) or
    // after the animation finishes (handled separately by the MutationObserver below). Re-querying
    // 60 times a second was pure overhead, not protection against anything that occurs mid-reveal.
    let cachedLine: SVGPathElement | null = null;
    let cachedFill: SVGPathElement | null = null;

    function getPaths(): { line: SVGPathElement | null; fill: SVGPathElement | null } {
      if (!cachedLine?.isConnected) cachedLine = container!.querySelector<SVGPathElement>(".recharts-area-curve");
      if (!cachedFill?.isConnected) cachedFill = container!.querySelector<SVGPathElement>(".recharts-area-area");
      return { line: cachedLine, fill: cachedFill };
    }

    function applyFrame(eased: number) {
      const { line: linePath, fill: fillPath } = getPaths();
      if (!linePath || !fillPath) return false;
      linePath.style.strokeDasharray = String(DASH_LENGTH);
      linePath.style.strokeDashoffset = String(DASH_LENGTH * (1 - eased));
      fillPath.style.opacity = String(Math.max(0, Math.min(1, (eased - 0.15) / 0.85)));
      return true;
    }

    // The glow is an SVG drop-shadow filter, and browsers can't composite those on the GPU — every
    // frame the filtered region has to be re-rasterized on the CPU. Applying it while the stroke is
    // actively drawing in (geometry changing every frame) was the actual cause of the dropped
    // frames/stutter — not the animation's duration. So it stays off the path entirely until the
    // reveal is done, then switches on once, onto a now-static shape that never needs re-rasterizing.
    function applyGlow() {
      const { line: linePath } = getPaths();
      if (linePath) linePath.style.filter = `url(#${equityStrokeId}-glow)`;
    }

    // Drops a small pulsing "live" marker on the most recent point once the draw-in has reached
    // it — additive to the reveal above (reads the already-rendered path, doesn't touch dash
    // offsets), so it can't desync the line/fill animation it's riding on.
    function positionEndDot() {
      if (!endDot) return;
      const linePath = container!.querySelector<SVGPathElement>(".recharts-area-curve");
      const svg = container!.querySelector(".recharts-wrapper svg");
      if (!linePath || !svg) return;
      const points = parsePathPoints(linePath.getAttribute("d"));
      const last = points[points.length - 1];
      if (!last) return;
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container!.getBoundingClientRect();
      const x = svgRect.left - containerRect.left + last.x;
      const y = svgRect.top - containerRect.top + last.y;
      endDot.style.transform = `translate(${x}px, ${y}px)`;
      endDot.style.opacity = "1";
    }

    function tick(now: number) {
      // Elements may not exist yet on the very first frames (ResponsiveContainer measures its
      // size via ResizeObserver before rendering the real chart) — don't start the clock until
      // they're actually there, or the reveal would jump straight to a partway-done state.
      if (!getPaths().line) {
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
        positionEndDot();
      }
    }
    raf = requestAnimationFrame(tick);

    // Only re-applies when the line has actually drifted from its finished state (checked via a
    // cheap style read, not a style write) — this subtree also mutates on every single hover move
    // (see the custom overlay below), and doing real work on every one of those was adding
    // main-thread jank to hover updates.
    const observer = new MutationObserver(() => {
      if (!finished) return;
      const linePath = container!.querySelector<SVGPathElement>(".recharts-area-curve");
      if (linePath && linePath.style.strokeDashoffset !== "0") applyFrame(1);
      applyGlow();
      positionEndDot();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [equityCurve]);

  /** Recharts' own Tooltip + activeDot turned out to have a real internal lag bug (confirmed by
   *  screenshots + measurement): the cursor line tracks the mouse immediately, but the tooltip's
   *  payload and the active-point dot are driven by a separate, seemingly-batched internal state
   *  that visibly falls one point behind during normal hovering — the dot and tooltip text stay on
   *  the previously-hovered point while the cursor line has already moved to the next one. There's
   *  no prop to fix that; it's Recharts' own update ordering. So this chart no longer uses Recharts'
   *  Tooltip/activeDot at all. Instead: on every mousemove, read the actual rendered point
   *  coordinates straight from the line path's `d` attribute (parsePathPoints, above), find the
   *  nearest one to the cursor, and position our own cursor line / dot / tooltip box synchronously
   *  in the same handler — one code path, so nothing can lag behind anything else. */
  useEffect(() => {
    const container = chartRef.current;
    const cursorLineEl = cursorLineRef.current;
    const dotEl = dotRef.current;
    const tooltipEl = tooltipRef.current;
    const tooltipDateEl = tooltipDateRef.current;
    const tooltipCumEl = tooltipCumRef.current;
    const tooltipTradeWrapEl = tooltipTradeWrapRef.current;
    const tooltipTradeEl = tooltipTradeRef.current;
    if (
      !container ||
      !cursorLineEl ||
      !dotEl ||
      !tooltipEl ||
      !tooltipDateEl ||
      !tooltipCumEl ||
      !tooltipTradeWrapEl ||
      !tooltipTradeEl
    ) {
      return;
    }
    // Non-null now, reassigned to `const`s TS keeps narrowed inside the closures below (the
    // original `.current` reads stay possibly-null to TS even after this guard, since they're
    // captured by nested function declarations rather than used inline).
    const cursorLine: HTMLDivElement = cursorLineEl;
    const dot: HTMLDivElement = dotEl;
    const tooltip: HTMLDivElement = tooltipEl;
    const tooltipDate: HTMLDivElement = tooltipDateEl;
    const tooltipCum: HTMLSpanElement = tooltipCumEl;
    const tooltipTradeWrap: HTMLDivElement = tooltipTradeWrapEl;
    const tooltipTrade: HTMLSpanElement = tooltipTradeEl;

    let cachedPoints: { x: number; y: number }[] | null = null;

    function getPoints(): { x: number; y: number }[] {
      if (cachedPoints && cachedPoints.length === equityCurve.length) return cachedPoints;
      const linePath = container!.querySelector<SVGPathElement>(".recharts-area-curve");
      const parsed = parsePathPoints(linePath?.getAttribute("d") ?? null);
      if (parsed.length === equityCurve.length) cachedPoints = parsed;
      return parsed;
    }

    function hide() {
      cursorLine.style.opacity = "0";
      dot.style.opacity = "0";
      tooltip.style.opacity = "0";
    }

    function handleMove(e: MouseEvent) {
      const points = getPoints();
      if (points.length === 0) return;
      const svg = container!.querySelector(".recharts-wrapper svg");
      if (!svg) return;
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container!.getBoundingClientRect();
      const localX = e.clientX - svgRect.left;

      let nearestIndex = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].x - localX);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIndex = i;
        }
      }

      const point = points[nearestIndex];
      const data = equityCurve[nearestIndex];
      if (!point || !data) return;

      const svgOffsetX = svgRect.left - containerRect.left;
      const svgOffsetY = svgRect.top - containerRect.top;
      const overlayX = svgOffsetX + point.x;
      const overlayY = svgOffsetY + point.y;
      // Matches the line's own coloring rule (cumulative position, not the individual trade) so the
      // hover dot never renders a color that visibly clashes with the segment it's sitting on.
      const color = data.cumulativeR >= 0 ? "#34d399" : "#ef4444";

      cursorLine.style.opacity = "1";
      cursorLine.style.transform = `translateX(${overlayX}px)`;

      dot.style.opacity = "1";
      dot.style.transform = `translate(${overlayX}px, ${overlayY}px)`;
      dot.style.borderColor = color;

      tooltipDate.textContent = format(new Date(data.date), "PP");
      tooltipCum.textContent = `${data.cumulativeR.toFixed(2)}R`;
      tooltipTrade.textContent = `${data.tradeR >= 0 ? "+" : ""}${data.tradeR.toFixed(2)}R`;
      tooltipTradeWrap.style.color = data.tradeR >= 0 ? "var(--color-success)" : "var(--color-danger)";

      const containerWidth = containerRect.width;
      const tooltipWidth = tooltip.offsetWidth || 150;
      const flip = overlayX + 12 + tooltipWidth > containerWidth;
      tooltip.style.opacity = "1";
      tooltip.style.transform = `translate(${flip ? overlayX - tooltipWidth - 12 : overlayX + 12}px, 8px)`;
    }

    function handleLeave() {
      hide();
    }

    cachedPoints = null;
    container.addEventListener("mousemove", handleMove);
    container.addEventListener("mouseleave", handleLeave);

    // Our overlay is positioned imperatively from the point last computed on mousemove — if the
    // container resizes (window resize, or other dashboard content shifting this card's width)
    // while it's showing, that position instantly goes stale relative to the newly-laid-out chart.
    // Simplest correct fix: hide on any width change; it reappears correctly-positioned on the next
    // mousemove rather than sitting somewhere wrong.
    let lastWidth = container.getBoundingClientRect().width;
    const resizeObserver = new ResizeObserver((entries) => {
      const newWidth = entries[0]?.contentRect.width;
      if (newWidth == null || Math.abs(newWidth - lastWidth) < 1) return;
      lastWidth = newWidth;
      cachedPoints = null;
      hide();
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mouseleave", handleLeave);
      resizeObserver.disconnect();
    };
  }, [equityCurve]);

  /** Which color each segment should be — red only while the curve is actually underwater
   *  (cumulative R below its starting baseline), green everywhere else — matching a classic
   *  "profit vs. drawdown" equity chart, where a single losing trade that's still net profitable
   *  overall doesn't turn the line red. Shared by both stop builders below so they always agree. */
  const segmentColors = useMemo(() => {
    const points = equityCurve;
    if (points.length < 2) return [];
    const colors: boolean[] = []; // true = green/above water
    for (let i = 1; i < points.length; i++) colors.push(points[i].cumulativeR >= 0);
    return colors;
  }, [equityCurve]);

  /** Run-length-encoded color stops: a new stop pair only where the color actually *changes*,
   *  not one per trade. With real trade data the line is mostly one long green run with red only
   *  during genuine drawdowns, so this is typically 2-6 stops total instead of two-per-trade —
   *  which matters a lot for an animating gradient, since the browser has to re-resolve however
   *  many stops exist on every frame the visible portion changes. A gradient with dozens of stops
   *  changing every frame (one full trade history's worth) was visibly janky; a handful isn't. */
  const equityLineStops = useMemo(() => {
    const segments = segmentColors.length;
    if (segments === 0) return [];
    const stops: { offset: number; color: string }[] = [];
    let runStart = 0;
    for (let i = 0; i <= segments; i++) {
      const changed = i === segments || segmentColors[i] !== segmentColors[runStart];
      if (changed) {
        const color = segmentColors[runStart] ? "#34d399" : "#ef4444";
        stops.push({ offset: (runStart / segments) * 100, color });
        stops.push({ offset: (i / segments) * 100, color });
        runStart = i;
      }
    }
    return stops;
  }, [segmentColors]);

  /** Same run-collapsed coloring as the line, as a translucent tint (plain color + stop-opacity)
   *  rather than blended with the surface via color-mix() — that function evaluated inside an SVG
   *  `stop-color` *attribute* (not a CSS `style` property, where support is far more consistent)
   *  was the actual cause of the fill visibly flickering: an unreliably-supported paint value that
   *  the renderer had to keep re-resolving. Plain hex + stop-opacity is universally supported and
   *  paints once, no flicker. The vertical mask (below) still does the "wisp" fade toward the
   *  bottom on top of this. */
  const equityFillStops = useMemo(() => {
    const segments = segmentColors.length;
    if (segments === 0) return [];
    const feather = Math.min(2.5, 100 / segments / 4);
    const stops: { offset: number; color: string; opacity: number }[] = [];
    let runStart = 0;
    for (let i = 0; i <= segments; i++) {
      const changed = i === segments || segmentColors[i] !== segmentColors[runStart];
      if (changed) {
        const color = segmentColors[runStart] ? "#34d399" : "#ef4444";
        const start = (runStart / segments) * 100;
        const end = (i / segments) * 100;
        stops.push({ offset: runStart === 0 ? start : start + feather, color, opacity: 0.5 });
        stops.push({ offset: i === segments ? end : end - feather, color, opacity: 0.5 });
        runStart = i;
      }
    }
    return stops;
  }, [segmentColors]);

  /** Weekly-cadence x-axis ticks (snapped to the nearest actual trade date), so the axis reads
   *  as calendar time rather than every single trade date once history grows. The step widens
   *  past weekly only once weekly would produce more than ~8 labels, so a long trade history
   *  still stays readable instead of crowding the axis. */
  const equityXTicks = useMemo(() => {
    const points = equityCurve;
    if (points.length < 2) return undefined;
    const dayMs = 86400000;
    const first = new Date(points[0].date).getTime();
    const last = new Date(points[points.length - 1].date).getTime();
    const spanDays = (last - first) / dayMs;
    const stepOptions = [7, 14, 21, 30, 60, 90, 182, 365];
    let stepDays = stepOptions[stepOptions.length - 1];
    for (const d of stepOptions) {
      if (spanDays / d <= 8) {
        stepDays = d;
        break;
      }
    }
    const stepMs = stepDays * dayMs;
    const ticks: string[] = [];
    for (let t = first; t <= last; t += stepMs) {
      let nearest = points[0];
      let nearestDiff = Infinity;
      for (const p of points) {
        const diff = Math.abs(new Date(p.date).getTime() - t);
        if (diff < nearestDiff) {
          nearestDiff = diff;
          nearest = p;
        }
      }
      if (!ticks.includes(nearest.date)) ticks.push(nearest.date);
    }
    const lastDate = points[points.length - 1].date;
    if (!ticks.includes(lastDate)) ticks.push(lastDate);
    return ticks;
  }, [equityCurve]);

  return (
    <Card className="relative shadow-lg shadow-black/20 lg:col-span-2">
      <div
        className="h-1 rounded-t-lg"
        style={{ background: totalR >= 0 ? "linear-gradient(90deg, #059669, #34d399)" : "linear-gradient(90deg, #dc2626, #f87171)" }}
      />
      <CardHeader className="flex-row items-center justify-between space-y-0 gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconBadge icon={TrendingUp} tone={totalR >= 0 ? "green" : "red"} size={32} />
          <CardTitle className="text-sm font-bold text-[var(--color-text)]">Equity Curve (R)</CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {maxDrawdownR != null && (
            <span className="rounded-full bg-[var(--color-danger)]/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--color-text-muted)]">
              Max DD −{Math.abs(maxDrawdownR).toFixed(2)}R
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums shadow-sm",
              totalR >= 0 ? "bg-[#34d399]/15 text-[#34d399]" : "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
            )}
          >
            {animatedTotalR >= 0 ? "+" : ""}
            {animatedTotalR.toFixed(2)}R
          </span>
        </div>
      </CardHeader>
      <CardContent ref={chartRef} className="equity-curve-chart relative h-64">
        {/* No card-level pop-in here on purpose — the line drawing itself in and the fill fading in
            behind it (driven imperatively, see the effect above) are the entrance; a simultaneous
            whole-card scale/opacity pop was visually louder than that and read as the only motion.
            The fade mask stays static (always on) — no toggling, no CSS keyframe. The glow filter
            is deliberately NOT set here (see applyGlow in the effect above): switching it on only
            after the reveal finishes is what keeps the draw-in itself smooth. The line/fill start
            hidden via plain CSS so there's no flash of the fully-drawn state before the effect above
            finds the elements and takes over. */}
        <style>{`
          .equity-curve-chart .recharts-area-area {
            mask: url(#${equityStrokeId}-fillmask);
            -webkit-mask: url(#${equityStrokeId}-fillmask);
            opacity: 0;
          }
          .equity-curve-chart .recharts-area-curve {
            stroke-dasharray: ${DASH_LENGTH};
            stroke-dashoffset: ${DASH_LENGTH};
          }
        `}</style>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={equityCurve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={equityStrokeId} x1="0" y1="0" x2="1" y2="0">
                {equityLineStops.map((s, i) => (
                  <stop key={i} offset={`${s.offset}%`} stopColor={s.color} />
                ))}
              </linearGradient>
              {/* Same segment colors as the line, as a translucent tint (see equityFillStops) —
                  kept as its own gradient so nothing here touches the line's own crisp opacity. */}
              <linearGradient id={`${equityStrokeId}-fill`} x1="0" y1="0" x2="1" y2="0">
                {equityFillStops.map((s, i) => (
                  <stop key={i} offset={`${s.offset}%`} stopColor={s.color} stopOpacity={s.opacity} />
                ))}
              </linearGradient>
              {/* Vertical fade applied only to the fill (via the scoped mask/CSS above) — a lush,
                  deep "filled mountain" coating that stays substantial most of the way down
                  before tapering off, rather than a thin wisp hugging just the line. */}
              <linearGradient id={`${equityStrokeId}-fade`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity={0.95} />
                <stop offset="30%" stopColor="white" stopOpacity={0.55} />
                <stop offset="65%" stopColor="white" stopOpacity={0.26} />
                <stop offset="100%" stopColor="white" stopOpacity={0.05} />
              </linearGradient>
              <mask id={`${equityStrokeId}-fillmask`} maskUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
                <rect x="0" y="0" width="100%" height="100%" fill={`url(#${equityStrokeId}-fade)`} />
              </mask>
              {/* Glow is applied only to the line stroke (scoped CSS above), not the fill beneath it —
                  a shadow under the whole coated area read as a heavy, murky block. */}
              <filter id={`${equityStrokeId}-glow`} x="-20%" y="-60%" width="140%" height="220%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2.8" floodColor="#000000" floodOpacity="0.4" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 8" stroke="var(--color-border)" strokeOpacity={0.35} />
            <XAxis
              dataKey="date"
              ticks={equityXTicks}
              tickFormatter={(v) => format(new Date(v), "MMM d")}
              tick={{ fontSize: 11 }}
              stroke="var(--color-text-muted)"
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--color-text-muted)"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}R`}
              width={36}
            />
            {/* A solid baseline at breakeven — the reference point everything above/below the
                curve actually means, distinct from the dashed grid around it. */}
            <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeOpacity={0.45} strokeWidth={1} />
            <Area
              type="monotone"
              dataKey="cumulativeR"
              stroke={`url(#${equityStrokeId})`}
              fill={`url(#${equityStrokeId}-fill)`}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Custom hover overlay — see the effect above for why Recharts' own Tooltip/activeDot
            aren't used. Positioned via transform (not left/top) so updates are pure compositor
            work, no layout/reflow per mouse move. */}
        <div
          ref={cursorLineRef}
          className="pointer-events-none absolute top-2 bottom-6 left-0 w-px bg-[var(--color-text-muted)] opacity-0"
          style={{ willChange: "transform" }}
        />
        <div
          ref={dotRef}
          className="pointer-events-none absolute top-0 left-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 opacity-0"
          style={{ background: "var(--color-surface)", willChange: "transform" }}
        />
        {/* "Live" marker on the most recent point — dropped in once the draw-in animation reaches
            it (see positionEndDot above), a soft pulsing ring reads as "this is where you are now"
            on the curve, the way live-market charts mark the current price. */}
        <div
          ref={endDotRef}
          className="pointer-events-none absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-300"
          style={{ willChange: "transform" }}
        >
          <span className="relative flex h-3 w-3">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: totalR >= 0 ? "#34d399" : "#ef4444" }}
            />
            <span
              className="relative inline-flex h-3 w-3 rounded-full border-2 border-[var(--color-surface)]"
              style={{ background: totalR >= 0 ? "#34d399" : "#ef4444" }}
            />
          </span>
        </div>
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute top-0 left-0 z-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs opacity-0 shadow-lg"
          style={{ willChange: "transform" }}
        >
          <div ref={tooltipDateRef} className="mb-1 font-medium text-[var(--color-text)]" />
          <div className="text-[var(--color-text-muted)]">
            Cumulative: <span ref={tooltipCumRef} className="font-semibold text-[var(--color-text)] tabular-nums" />
          </div>
          <div ref={tooltipTradeWrapRef}>
            Trade: <span ref={tooltipTradeRef} className="font-semibold tabular-nums" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
