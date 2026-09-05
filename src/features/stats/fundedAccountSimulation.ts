export type PayoutFrequency = "weekly" | "biweekly" | "monthly";

export interface FundedAccountOptions {
  accountType: "safe" | "static" | "elastic" | "custom";
  maxDrawdownPct: number; // e.g. 10 for 10%
  payoutFrequency: PayoutFrequency;
  riskPerTradePct: number; // e.g. 1 for 1% risk per trade
  tradesPerPeriod: number; // avg trades between payout checkpoints
  numPaths?: number;
  maxTradesPerPath?: number;
}

export interface FundedAccountResult {
  riskOfRuinPct: number;
  medianSuccessfulPayouts: number;
  avgTradesToRuin: number;
  avgPayoutSizePct: { median: number; best: number; worst: number };
  survivalCurve: { tradeIndex: number; survivalPct: number }[];
}

const PAYOUT_CHECKPOINT_TRADES: Record<PayoutFrequency, number> = {
  weekly: 15,
  biweekly: 30,
  monthly: 60,
};

export function runFundedAccountSimulation(
  historicalR: number[],
  options: FundedAccountOptions,
): FundedAccountResult {
  const numPaths = options.numPaths ?? 1000;
  const maxTrades = options.maxTradesPerPath ?? 500;
  const checkpointTrades = PAYOUT_CHECKPOINT_TRADES[options.payoutFrequency];
  const drawdownLimitPct = options.maxDrawdownPct;

  if (historicalR.length === 0) {
    return {
      riskOfRuinPct: 0,
      medianSuccessfulPayouts: 0,
      avgTradesToRuin: 0,
      avgPayoutSizePct: { median: 0, best: 0, worst: 0 },
      survivalCurve: [],
    };
  }

  let ruinedCount = 0;
  const tradesToRuin: number[] = [];
  const payoutCounts: number[] = [];
  const payoutSizes: number[] = [];
  const aliveAtTrade = new Array(maxTrades + 1).fill(0);

  for (let p = 0; p < numPaths; p++) {
    let equityPct = 0; // cumulative return in % terms
    let peakPct = 0;
    let payouts = 0;
    let ruined = false;
    let ruinTrade = -1;

    for (let i = 0; i < maxTrades; i++) {
      const r = historicalR[Math.floor(Math.random() * historicalR.length)];
      equityPct += r * options.riskPerTradePct;
      if (equityPct > peakPct) peakPct = equityPct;

      const isElastic = options.accountType === "elastic";
      const drawdownFloor = isElastic ? peakPct - drawdownLimitPct : -drawdownLimitPct;
      const drawdown = peakPct - equityPct;

      if ((isElastic && equityPct < drawdownFloor) || (!isElastic && equityPct < -drawdownLimitPct)) {
        ruined = true;
        ruinTrade = i;
        break;
      }
      void drawdown;

      if ((i + 1) % checkpointTrades === 0 && equityPct > 0) {
        payouts += 1;
        payoutSizes.push(equityPct);
        // Withdraw profit above zero baseline, keep trading from flat.
        equityPct = 0;
        peakPct = 0;
      }

      aliveAtTrade[i + 1] += 1;
    }

    if (ruined) {
      ruinedCount += 1;
      tradesToRuin.push(ruinTrade);
    }
    payoutCounts.push(payouts);
  }

  const sortedPayoutCounts = [...payoutCounts].sort((a, b) => a - b);
  const sortedPayoutSizes = [...payoutSizes].sort((a, b) => a - b);
  const median = (arr: number[]) => (arr.length === 0 ? 0 : arr[Math.floor(arr.length / 2)]);

  const survivalCurve = aliveAtTrade.map((count, i) => ({
    tradeIndex: i,
    survivalPct: (count / numPaths) * 100,
  }));

  return {
    riskOfRuinPct: (ruinedCount / numPaths) * 100,
    medianSuccessfulPayouts: median(sortedPayoutCounts),
    avgTradesToRuin: tradesToRuin.length > 0 ? tradesToRuin.reduce((a, b) => a + b, 0) / tradesToRuin.length : 0,
    avgPayoutSizePct: {
      median: median(sortedPayoutSizes),
      best: sortedPayoutSizes[sortedPayoutSizes.length - 1] ?? 0,
      worst: sortedPayoutSizes[0] ?? 0,
    },
    survivalCurve,
  };
}
