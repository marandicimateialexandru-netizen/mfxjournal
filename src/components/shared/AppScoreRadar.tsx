import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { AppScoreBreakdown } from "@/features/stats/appScore";

export function AppScoreRadar({ breakdown }: { breakdown: AppScoreBreakdown }) {
  const data = breakdown.subScores.map((s) => ({ label: s.label, value: Math.round(s.value) }));
  const score = Math.round(breakdown.score);

  return (
    <div className="space-y-4">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
            <Radar
              dataKey="value"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.35}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">App Score</span>
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
  "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #84cc16, #22c55e)";

function scoreColor(score: number): string {
  if (score < 35) return "#ef4444";
  if (score < 55) return "#f59e0b";
  if (score < 75) return "#eab308";
  return "#22c55e";
}
