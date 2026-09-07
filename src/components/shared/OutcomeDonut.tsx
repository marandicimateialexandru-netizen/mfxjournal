import { useId, useState } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { useCountUp } from "@/lib/useCountUp";

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
          transition: d 260ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 260ms ease;
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
              <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.4" />
              </filter>
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
              style={{ filter: `url(#${glowId})` }}
              onMouseEnter={(entry: PieSectorDataItem) => {
                const segment = entry.payload as Segment | undefined;
                if (segment) setHoveredKey(segment.key);
              }}
              onMouseLeave={() => setHoveredKey(null)}
              activeShape={(props: PieSectorDataItem) => {
                const segment = props.payload as Segment | undefined;
                return (
                  <Sector
                    {...props}
                    outerRadius={(Number(props.outerRadius) || 0) + 6}
                    stroke={segment?.base ?? "var(--color-surface)"}
                    strokeWidth={2}
                  />
                );
              }}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((d) => (
                <Cell key={d.key} fill={`url(#${gradientId}-${d.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="absolute h-24 w-24 rounded-full transition-colors duration-200"
            style={{
              background: hovered
                ? `radial-gradient(circle, color-mix(in srgb, ${hovered.base} 22%, transparent), transparent 72%)`
                : "radial-gradient(circle, color-mix(in srgb, var(--color-success) 22%, transparent), transparent 72%)",
            }}
          />
          {hovered ? (
            <>
              <span className="relative text-xl font-extrabold tabular-nums" style={{ color: hovered.base }}>
                {hovered.value}
              </span>
              <span className="relative max-w-[6rem] text-center text-[11px] leading-tight text-[var(--color-text-muted)]">
                {hovered.name} · {hovered.pct}%
              </span>
            </>
          ) : (
            <>
              <span className="relative text-2xl font-extrabold tabular-nums text-gradient-profit">{Math.round(animatedTotal)}</span>
              <span className="relative text-[11px] text-[var(--color-text-muted)]">trades</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
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
