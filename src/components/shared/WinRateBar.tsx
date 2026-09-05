export function WinRateBar({ winPct, bePct = 0 }: { winPct: number; bePct?: number }) {
  const lossPct = Math.max(0, 100 - winPct - bePct);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-background)]">
      {winPct > 0 && <div className="h-full bg-[var(--color-success)]" style={{ width: `${winPct}%` }} />}
      {bePct > 0 && <div className="h-full bg-[var(--color-warning)]" style={{ width: `${bePct}%` }} />}
      {lossPct > 0 && <div className="h-full bg-[var(--color-danger)]" style={{ width: `${lossPct}%` }} />}
    </div>
  );
}
