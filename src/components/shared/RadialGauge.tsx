import { useId } from "react";

export function RadialGauge({
  value,
  max = 100,
  size = 72,
  strokeWidth = 7,
  label,
  color = "var(--color-primary)",
  gradient,
  showValue = true,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
  /** Optional [from, to] color pair rendered as a gradient stroke instead of a flat `color`. */
  gradient?: [string, string];
  /** Set false for a purely decorative ring when the value is already shown elsewhere in the tile. */
  showValue?: boolean;
}) {
  const gradientId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circumference * (1 - pct);
  const stroke = gradient ? `url(#${gradientId})` : color;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      {showValue && (
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-sm font-semibold tabular-nums text-[var(--color-text)]">{Math.round(value)}</span>
          {label && <span className="text-[9px] text-[var(--color-text-muted)]">{label}</span>}
        </div>
      )}
    </div>
  );
}

export function DualBarGauge({ winPct, bePct = 0 }: { winPct: number; bePct?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-danger)]/30">
      <div className="flex h-full">
        <div className="h-full bg-[var(--color-success)]" style={{ width: `${winPct}%` }} />
        <div className="h-full bg-[var(--color-warning)]" style={{ width: `${bePct}%` }} />
      </div>
    </div>
  );
}
