/** Stacked win/BE bar. The remainder (losses) is left as an unfilled dark track — losses never get their own color here. */
export function WinRateBar({ winPct, bePct = 0 }: { winPct: number; bePct?: number }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-background)]">
      <div
        className="h-full bg-[var(--color-success)] transition-[width] duration-500 ease-out"
        style={{ width: `${winPct}%` }}
      />
      <div
        className="h-full bg-[var(--color-warning)] transition-[width] duration-500 ease-out"
        style={{ width: `${bePct}%` }}
      />
    </div>
  );
}
