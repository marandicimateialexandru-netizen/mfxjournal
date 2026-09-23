import { useId } from "react";

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
  const gradientId = useId();
  const glowId = useId();
  const height = width * 0.56;
  const strokeWidth = width * 0.11;
  const r = (width - strokeWidth) / 2;
  const cy = height - strokeWidth / 2;
  const pct = Math.max(0, Math.min(100, winPct));

  const arcPath = `M ${strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${width - strokeWidth / 2} ${cy}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#34d399" floodOpacity="0.45" />
          </filter>
        </defs>
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
          opacity={0.85}
        />
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
          filter={`url(#${glowId})`}
        />
      </svg>
      <div className="flex items-center gap-1.5 text-[10px] font-bold tabular-nums">
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-success)]/15 px-1.5 py-0.5 text-[var(--color-success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
          {winLabel}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-danger)]/15 px-1.5 py-0.5 text-[var(--color-danger)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-danger)]" />
          {lossLabel}
        </span>
      </div>
    </div>
  );
}
