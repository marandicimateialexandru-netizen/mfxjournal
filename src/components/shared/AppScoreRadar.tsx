import { useId } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { AppScoreBreakdown } from "@/features/stats/appScore";
import { tooltipContentStyle, tooltipLabelStyle } from "@/lib/chartTheme";

export function AppScoreRadar({ breakdown }: { breakdown: AppScoreBreakdown }) {
  const gradientId = useId();
  const data = breakdown.subScores.map((s) => ({ label: s.label, value: Math.round(s.value) }));
  const score = Math.round(breakdown.score);

  return (
    <div className="animate-radar-pop space-y-4">
      <div className="h-56">
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

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-[var(--color-text-muted)]">App Score</span>
          <span className="text-2xl font-extrabold tabular-nums text-gradient-profit">{score}</span>
        </div>
        <div className="relative h-2.5 w-full rounded-full" style={{ background: SCORE_GRADIENT }}>
          <div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `calc(${score}% - 8px)`, background: scoreColor(score) }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

const SCORE_GRADIENT =
  "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #84cc16, #34d399)";

function scoreColor(score: number): string {
  if (score < 35) return "#ef4444";
  if (score < 55) return "#f59e0b";
  if (score < 75) return "#eab308";
  return "#34d399";
}
