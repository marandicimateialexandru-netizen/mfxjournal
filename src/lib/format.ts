export type CalcMode = "r" | "percent" | "dollar";

/** Converts a raw R-multiple into the unit the user wants displayed (R / % / $). */
export function convertR(
  r: number,
  mode: CalcMode,
  riskPerRPercent: number | null | undefined,
  riskPerRDollar: number | null | undefined,
): number {
  if (mode === "percent") return r * (riskPerRPercent ?? 1);
  if (mode === "dollar") return r * (riskPerRDollar ?? 100);
  return r;
}

export function formatR(
  r: number,
  mode: CalcMode = "r",
  riskPerRPercent?: number | null,
  riskPerRDollar?: number | null,
  opts?: { decimals?: number; showSign?: boolean },
): string {
  const decimals = opts?.decimals ?? 2;
  const value = convertR(r, mode, riskPerRPercent, riskPerRDollar);
  const sign = opts?.showSign && value > 0 ? "+" : "";
  const num = value.toFixed(decimals);
  if (mode === "percent") return `${sign}${num}%`;
  if (mode === "dollar") return `${sign}$${addThousands(num)}`;
  return `${sign}${num}R`;
}

function addThousands(numStr: string): string {
  const neg = numStr.startsWith("-");
  const clean = neg ? numStr.slice(1) : numStr;
  const [int, dec] = clean.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${withCommas}${dec ? "." + dec : ""}`;
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}
