/** Stacked win/BE bar. The remainder (losses) is left as an unfilled dark track — losses never get their own color here.
 *  No animation here on purpose: this renders once per row (potentially dozens at once across the
 *  Variables section — every day, every hour, every custom variable value), and it used to animate
 *  the CSS `width` property, which forces a full page layout recalculation on every single frame.
 *  Dozens of those running concurrently on dashboard mount was real, page-wide layout-thrashing —
 *  worse than any single chart's cost. It just renders at its final width immediately now. */
export function WinRateBar({ winPct, bePct = 0 }: { winPct: number; bePct?: number }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-background)]">
      <div className="h-full bg-[var(--color-success)]" style={{ width: `${winPct}%` }} />
      <div className="h-full bg-[var(--color-warning)]" style={{ width: `${bePct}%` }} />
    </div>
  );
}
