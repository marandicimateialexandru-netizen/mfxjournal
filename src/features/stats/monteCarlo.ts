export interface MonteCarloOptions {
  numTrades: number;
  numPaths?: number;
}

export interface MonteCarloResult {
  totalRDistribution: number[]; // one value per simulated path
  maxDrawdownDistribution: number[];
  medianTotalR: number;
  worstTotalR5pct: number;
  medianMaxDrawdown: number;
  worstMaxDrawdown5pct: number;
  probabilityPositive: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

function simulateOnePath(rDistribution: number[], numTrades: number): { totalR: number; maxDrawdown: number } {
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (let i = 0; i < numTrades; i++) {
    const r = rDistribution[Math.floor(Math.random() * rDistribution.length)];
    cumulative += r;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return { totalR: cumulative, maxDrawdown };
}

export function runMonteCarlo(historicalR: number[], options: MonteCarloOptions): MonteCarloResult {
  const numPaths = options.numPaths ?? 1000;
  if (historicalR.length === 0) {
    return {
      totalRDistribution: [],
      maxDrawdownDistribution: [],
      medianTotalR: 0,
      worstTotalR5pct: 0,
      medianMaxDrawdown: 0,
      worstMaxDrawdown5pct: 0,
      probabilityPositive: 0,
    };
  }

  const totalRDistribution: number[] = [];
  const maxDrawdownDistribution: number[] = [];

  for (let p = 0; p < numPaths; p++) {
    const { totalR, maxDrawdown } = simulateOnePath(historicalR, options.numTrades);
    totalRDistribution.push(totalR);
    maxDrawdownDistribution.push(maxDrawdown);
  }

  const sortedTotalR = [...totalRDistribution].sort((a, b) => a - b);
  const sortedDrawdown = [...maxDrawdownDistribution].sort((a, b) => a - b);

  return {
    totalRDistribution,
    maxDrawdownDistribution,
    medianTotalR: percentile(sortedTotalR, 0.5),
    worstTotalR5pct: percentile(sortedTotalR, 0.05),
    medianMaxDrawdown: percentile(sortedDrawdown, 0.5),
    worstMaxDrawdown5pct: percentile(sortedDrawdown, 0.95),
    probabilityPositive: totalRDistribution.filter((r) => r > 0).length / totalRDistribution.length,
  };
}

export function buildHistogram(values: number[], numBins = 20): { bin: string; count: number; binStart: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binSize = range / numBins;
  const bins = Array.from({ length: numBins }, (_, i) => ({
    bin: (min + i * binSize).toFixed(1),
    binStart: min + i * binSize,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(numBins - 1, Math.floor((v - min) / binSize));
    bins[idx].count += 1;
  }
  return bins;
}
