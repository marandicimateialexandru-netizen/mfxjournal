import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

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
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const lossPct = total > 0 ? Math.round((losses / total) * 100) : 0;
  const bePct = 100 - winPct - lossPct;

  const data = [
    { name: "Wins", value: wins || 0.0001, color: "var(--color-success)" },
    { name: "BE", value: bes, color: "var(--color-warning)" },
    { name: "Losses", value: losses || 0.0001, color: "var(--color-danger)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <span className="text-sm font-bold tabular-nums text-[var(--color-success)]">{winPct}% TP</span>
      <div className="relative flex-1" style={{ minHeight: 0, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold tabular-nums text-gradient-profit">{total}</span>
          <span className="text-[11px] text-[var(--color-text-muted)]">trades</span>
        </div>
      </div>
      <span className="flex items-center gap-2 text-sm font-bold tabular-nums">
        {bePct > 0 && <span className="text-[var(--color-warning)]">{bePct}% BE</span>}
        <span className="text-[var(--color-danger)]">{lossPct}% SL</span>
      </span>
    </div>
  );
}
