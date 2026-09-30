import { Fragment, useId, useState } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { useCountUp } from "@/lib/useCountUp";
import { cn } from "@/lib/utils";

type Segment = {
  key: string;
  name: string;
  value: number;
  pct: number;
  base: string;
  deep: string;
};

export function OutcomeDonut({
  wins,
  losses,
  bes,
  total,
}: {
  wins: number;
  losses: number;
  bes: number;
  total: number;
}) {
  const gradientId = useId();
  const glowId = useId();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const lossPct = total > 0 ? Math.round((losses / total) * 100) : 0;
  const bePct = Math.max(0, 100 - winPct - lossPct);

  const allSegments: Segment[] = [
    { key: "wins", name: "Take Profit", value: wins, pct: winPct, base: "color-mix(in srgb, #34d399 88%, white)", deep: "color-mix(in srgb, #34d399 72%, black)" },
    { key: "be", name: "Break Even", value: bes, pct: bePct, base: "color-mix(in srgb, #f5a524 88%, white)", deep: "color-mix(in srgb, #f5a524 72%, black)" },
    { key: "losses", name: "Stop Loss", value: losses, pct: lossPct, base: "color-mix(in srgb, #ef4444 88%, white)", deep: "color-mix(in srgb, #ef4444 72%, black)" },
  ];
  const segments = allSegments.filter((s) => s.value > 0);
  const data =
    segments.length > 0 ? segments : [{ key: "empty", name: "No trades", value: 1, pct: 0, base: "var(--color-border)", deep: "var(--color-border)" }];

  const animatedTotal = useCountUp(total, 900);
  const hovered = segments.find((s) => s.key === hoveredKey) ?? null;

  return (
    <div className="outcome-donut-chart flex h-full flex-col items-center justify-center gap-2">
      <style>{`
        .outcome-donut-chart .recharts-sector {
          transition: d 260ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 200ms ease;
        }
      `}</style>
      <div className="relative w-full flex-1" style={{ minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((d) => (
                <linearGradient key={d.key} id={`${gradientId}-${d.key}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={d.base} />
                  <stop offset="100%" stopColor={d.deep} />
                </linearGradient>
              ))}
              {/* One glow filter per segment, colored to match it (replacing a single generic black
                  drop-shadow) — a hovered green slice glows green, a red one glows red, instead of
                  every segment getting the same flat dark halo regardless of its own color. */}
              {data.map((d) => (
                <filter key={d.key} id={`${glowId}-${d.key}`} x="-60%" y="-60%" width="220%" height="220%">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={d.base} floodOpacity="0.65" />
                </filter>
              ))}
            </defs>

            {/* Faint track ring beneath the colored arcs, for layered depth */}
            <Pie
              data={[{ value: 1 }]}
              dataKey="value"
              innerRadius="60%"
              outerRadius="90%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
              fill="var(--color-border)"
              fillOpacity={0.3}
              isAnimationActive={false}
            />

            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={segments.length > 1 ? 5 : 0}
              cornerRadius={3}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              onMouseEnter={(entry: PieSectorDataItem) => {
                const segment = entry.payload as Segment | undefined;
                if (segment) setHoveredKey(segment.key);
              }}
              onMouseLeave={() => setHoveredKey(null)}
              activeShape={(props: PieSectorDataItem) => {
                // Recharts hands us a props object that already carries a `key` — spreading it
                // straight into JSX trips React's "key must be passed directly" warning, so it's
                // stripped here before the spread (the element itself doesn't need a key; it's a
                // single returned node, not a list item).
                const { key: _key, ...rest } = props as PieSectorDataItem & { key?: string };
                const segment = rest.payload as Segment | undefined;
                return (
                  // The glow filter only ever lands on this one hovered sector — a static, one-off
                  // element, not the whole group mid-entrance-animation — so it never has to fight
                  // an actively-changing shape for a per-frame re-rasterize (the base <Pie> used to
                  // carry this filter permanently, including through its 900ms mount animation,
                  // which is what was actually causing the frame drops/stutter on load).
                  <Sector
                    {...rest}
                    outerRadius={(Number(rest.outerRadius) || 0) + 8}
                    stroke={segment?.base ?? "var(--color-surface)"}
                    strokeWidth={2}
                    style={{ filter: segment ? `url(#${glowId}-${segment.key})` : undefined }}
                  />
                );
              }}
              // Recharts' own mount animation runs through its internal react-smooth engine — a
              // separate rAF+re-render loop competing with everything else animating on dashboard
              // mount. It's not worth that cost for a secondary chart; the sectors' own hover
              // transition (see the <style> block below) stays, just not the initial grow-in.
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={`url(#${gradientId}-${d.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={cn(
              "absolute h-24 w-24 rounded-full transition-[background,transform] duration-300 ease-out",
              hovered ? "scale-110" : "scale-100",
            )}
            style={{
              background: hovered
                ? `radial-gradient(circle, color-mix(in srgb, ${hovered.base} 26%, transparent), transparent 72%)`
                : "radial-gradient(circle, color-mix(in srgb, var(--color-success) 22%, transparent), transparent 72%)",
            }}
          />
          {hovered ? (
            // Keyed by segment so hovering a DIFFERENT slice remounts these spans (not just updates
            // their text) — that's what makes `animate-donut-center-pop` actually replay on every
            // switch, not just the first hover. No percentage here: it's already on the legend chip
            // below, so this stays just the count (which the count-up-style number already reads as
            // "the numbers are in the middle") and the plain category name.
            <Fragment key={hovered.key}>
              <span className="relative animate-donut-center-pop text-xl font-extrabold tabular-nums" style={{ color: hovered.base }}>
                {hovered.value}
              </span>
              <span className="relative animate-donut-center-pop max-w-[6rem] text-center text-[11px] font-semibold leading-tight text-[var(--color-text-muted)]">
                {hovered.name}
              </span>
            </Fragment>
          ) : (
            <Fragment key="total">
              <span className="relative animate-donut-center-pop text-2xl font-extrabold tabular-nums text-gradient-profit">{Math.round(animatedTotal)}</span>
              <span className="relative animate-donut-center-pop text-[11px] text-[var(--color-text-muted)]">trades</span>
            </Fragment>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {segments.map((s) => (
          <div
            key={s.key}
            className="flex items-center gap-1.5 rounded-full border px-2 py-1 transition-transform duration-150 hover:-translate-y-0.5"
            style={{ borderColor: `color-mix(in srgb, ${s.base} 30%, transparent)`, background: `color-mix(in srgb, ${s.base} 10%, var(--color-background))` }}
          >
            <span className="h-2 w-2 rounded-[3px]" style={{ background: s.base, boxShadow: `0 0 6px ${s.base}` }} />
            <span className="text-sm font-bold tabular-nums" style={{ color: s.base }}>
              {s.pct}%
            </span>
            <span className="text-xs font-medium text-[var(--color-text-muted)]">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
