export function ArcGauge({
  winPct,
  winLabel,
  lossLabel,
  width = 108,
}: {
  winPct: number;
  winLabel: string | number;
  lossLabel: string | number;
  width?: number;
}) {
  const height = width * 0.56;
  const strokeWidth = width * 0.11;
  const r = (width - strokeWidth) / 2;
  const cy = height - strokeWidth / 2;
  const pct = Math.max(0, Math.min(100, winPct));

  const arcPath = `M ${strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${width - strokeWidth / 2} ${cy}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
        />
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${100 - pct} 100`}
          strokeDashoffset={-pct}
        />
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
        />
      </svg>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tabular-nums">
        <span className="rounded px-1.5 py-0.5 bg-[var(--color-success)]/15 text-[var(--color-success)]">
          {winLabel}
        </span>
        <span className="rounded px-1.5 py-0.5 bg-[var(--color-danger)]/15 text-[var(--color-danger)]">
          {lossLabel}
        </span>
      </div>
    </div>
  );
}
