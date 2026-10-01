import { describe, it, expect } from "vitest";
import { computeStats } from "../computeStats";
import type { Trade } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

function trade(
  id: string,
  day: number,
  outcome: Trade["outcome"],
  result_r: number,
  variableValues?: Trade["variableValues"],
): Trade {
  // Mirrors what the real hydrate() in db/queries/trades.ts guarantees: valueIds always populated
  // alongside valueId, so fixtures written against the old single-valueId shape still match.
  const normalized = variableValues
    ? Object.fromEntries(
        Object.entries(variableValues).map(([k, v]) => [
          k,
          { ...v, valueIds: v.valueIds ?? (v.valueId ? [v.valueId] : undefined) },
        ]),
      )
    : variableValues;
  return {
    id,
    workspace_id: "ws1",
    strategy_id: null,
    account_id: null,
    entry_time: new Date(2026, 0, day, 9, 0).toISOString(),
    end_time: null,
    outcome,
    risk_r: 1,
    result_r,
    market: "EURUSD",
    notes: null,
    is_seed: 0,
    created_at: new Date(2026, 0, day).toISOString(),
    updated_at: new Date(2026, 0, day).toISOString(),
    variableValues: normalized,
  };
}

// Hand-computed fixture: win,win,loss,be,win,loss,loss,win,be,win — result_r: 2,1,-1,0,3,-2,-1,1,0,2
const FIXTURE: Trade[] = [
  trade("t1", 1, "win", 2, { var1: { valueId: "val-A" } }),
  trade("t2", 2, "win", 1, { var1: { valueId: "val-A" } }),
  trade("t3", 3, "loss", -1, { var1: { valueId: "val-B" } }),
  trade("t4", 4, "be", 0, { var1: { valueId: "val-A" } }),
  trade("t5", 5, "win", 3, { var1: { valueId: "val-B" } }),
  trade("t6", 6, "loss", -2, { var1: { valueId: "val-B" } }),
  trade("t7", 7, "loss", -1, { var1: { valueId: "val-A" } }),
  trade("t8", 8, "win", 1, { var1: { valueId: "val-A" } }),
  trade("t9", 9, "be", 0, { var1: { valueId: "val-B" } }),
  trade("t10", 10, "win", 2, { var1: { valueId: "val-A" } }),
];

const SETUP_VARIABLE: VariableWithValues = {
  id: "var1",
  workspace_id: "ws1",
  key: "setup",
  label: "Setup",
  type: "text",
  icon: null,
  sort_order: 0,
  allow_multiple: 0,
  values: [
    { id: "val-A", variable_id: "var1", label: "Setup A", icon: null, color: null, sort_order: 0 },
    { id: "val-B", variable_id: "var1", label: "Setup B", icon: null, color: null, sort_order: 1 },
  ],
};

describe("computeStats — core aggregates", () => {
  it("counts trades by outcome", () => {
    const result = computeStats(FIXTURE);
    expect(result.totalTrades).toBe(10);
    expect(result.wins).toBe(5);
    expect(result.losses).toBe(3);
    expect(result.breakEvens).toBe(2);
  });

  it("computes win rate excluding BE by default", () => {
    const result = computeStats(FIXTURE);
    expect(result.winRatePct).toBeCloseTo(62.5, 5); // 5/(5+3)*100
  });

  it("folds BE into the win-rate denominator when beInWinRate is true", () => {
    const result = computeStats(FIXTURE, { beInWinRate: true });
    expect(result.winRatePct).toBeCloseTo(50, 5); // 5/10*100
  });

  it("computes BE rate over all trades", () => {
    const result = computeStats(FIXTURE);
    expect(result.beRatePct).toBeCloseTo(20, 5); // 2/10*100
  });

  it("computes total R and expectancy", () => {
    const result = computeStats(FIXTURE);
    expect(result.totalR).toBeCloseTo(5, 5);
    expect(result.expectancyR).toBeCloseTo(0.5, 5); // 5/10
  });

  it("computes profit factor as sum(winning R) / abs(sum(losing R))", () => {
    const result = computeStats(FIXTURE);
    // winning R = 2+1+3+1+2 = 9, losing R = -1-2-1 = -4
    expect(result.profitFactor).toBeCloseTo(9 / 4, 5);
  });

  it("returns Infinity profit factor when there are wins but no losses", () => {
    const result = computeStats([trade("t1", 1, "win", 2)]);
    expect(result.profitFactor).toBe(Infinity);
  });

  it("returns 0 profit factor when there are no wins and no losses", () => {
    const result = computeStats([trade("t1", 1, "be", 0)]);
    expect(result.profitFactor).toBe(0);
  });

  it("computes avg win R and avg loss R", () => {
    const result = computeStats(FIXTURE);
    expect(result.avgWinR).toBeCloseTo(9 / 5, 5);
    expect(result.avgLossR).toBeCloseTo(-4 / 3, 5);
  });

  it("finds largest win and largest loss", () => {
    const result = computeStats(FIXTURE);
    expect(result.largestWin).toBe(3);
    expect(result.largestLoss).toBe(-2);
  });
});

describe("computeStats — equity curve & drawdown", () => {
  it("builds a chronological cumulative equity curve", () => {
    const result = computeStats(FIXTURE);
    const cumulative = result.equityCurve.map((p) => p.cumulativeR);
    expect(cumulative).toEqual([2, 3, 2, 2, 5, 3, 2, 3, 3, 5]);
  });

  it("computes the largest peak-to-trough decline and how many trades it spanned", () => {
    const result = computeStats(FIXTURE);
    // peak of 5 at index 4, trough of 2 at index 6 -> drawdown 3 over 2 trades
    expect(result.maxDrawdownR).toBeCloseTo(3, 5);
    expect(result.maxDrawdownTradeCount).toBe(2);
  });

  it("computes recovery factor as totalR / abs(maxDrawdown)", () => {
    const result = computeStats(FIXTURE);
    expect(result.recoveryFactor).toBeCloseTo(5 / 3, 5);
  });

  it("returns 0 drawdown for an all-winning sequence", () => {
    const result = computeStats([trade("t1", 1, "win", 1), trade("t2", 2, "win", 1)]);
    expect(result.maxDrawdownR).toBe(0);
  });
});

describe("computeStats — streaks", () => {
  it("computes max win/loss streaks and current streak, BE breaking the streak by default", () => {
    const result = computeStats(FIXTURE);
    expect(result.maxWinStreak).toBe(2);
    expect(result.maxLossStreak).toBe(2);
    expect(result.currentStreak).toEqual({ type: "win", count: 1 });
  });

  it("skips over BE instead of breaking the streak when beBreaksStreak is false", () => {
    const result = computeStats(FIXTURE, { beBreaksStreak: false });
    // ...win(1) -> be skipped -> win(2) at the end, since trade8(win) and trade10(win) are joined across the be at trade9
    expect(result.currentStreak).toEqual({ type: "win", count: 2 });
  });

  it("resets to none for an empty trade list", () => {
    const result = computeStats([]);
    expect(result.currentStreak).toEqual({ type: "none", count: 0 });
  });
});

describe("computeStats — filters", () => {
  it("filters by strategyId", () => {
    const trades = [
      { ...trade("t1", 1, "win", 2), strategy_id: "s1" },
      { ...trade("t2", 2, "win", 1), strategy_id: "s2" },
    ];
    const result = computeStats(trades, { strategyId: "s1" });
    expect(result.totalTrades).toBe(1);
    expect(result.totalR).toBeCloseTo(2, 5);
  });

  it("filters by dateRange inclusive", () => {
    const result = computeStats(FIXTURE, {
      dateRange: { start: new Date(2026, 0, 3), end: new Date(2026, 0, 5, 23, 59) },
    });
    expect(result.totalTrades).toBe(3); // t3, t4, t5
  });

  it("filters by variableFilters (AND across variables, OR within a variable's values)", () => {
    const result = computeStats(FIXTURE, {
      variableFilters: [{ variableId: "var1", valueIds: ["val-B"] }],
    });
    expect(result.totalTrades).toBe(4); // t3, t5, t6, t9
  });
});

describe("computeStats — byVariable", () => {
  it("groups trades by configured variable value and computes per-bucket stats", () => {
    const result = computeStats(FIXTURE, { variables: [SETUP_VARIABLE] });
    const buckets = result.byVariable["var1"];
    expect(buckets).toHaveLength(2);

    const bucketA = buckets.find((b) => b.valueId === "val-A")!;
    expect(bucketA.tradeCount).toBe(6);
    expect(bucketA.wins).toBe(4);
    expect(bucketA.losses).toBe(1);
    expect(bucketA.bes).toBe(1);
    expect(bucketA.winRatePct).toBeCloseTo(80, 5); // 4/(4+1)
    expect(bucketA.totalR).toBeCloseTo(5, 5); // 2+1+0-1+1+2

    const bucketB = buckets.find((b) => b.valueId === "val-B")!;
    expect(bucketB.tradeCount).toBe(4);
    expect(bucketB.wins).toBe(1);
    expect(bucketB.losses).toBe(2);
    expect(bucketB.winRatePct).toBeCloseTo(100 / 3, 5); // 1/3
    expect(bucketB.totalR).toBeCloseTo(0, 5); // -1+3-2+0
  });

  it("skips number-type variables (handled separately, not as win-rate buckets)", () => {
    const numberVar: VariableWithValues = { ...SETUP_VARIABLE, id: "var2", type: "number", values: [] };
    const result = computeStats(FIXTURE, { variables: [numberVar] });
    expect(result.byVariable["var2"]).toBeUndefined();
  });
});

describe("computeStats — custom results mapping", () => {
  it("resolves a custom result label to its underlying win/loss/be category", () => {
    const trades = [trade("t1", 1, "missed-entry", 0)];
    const result = computeStats(trades, {
      customResults: [{ id: "missed-entry", workspace_id: "ws1", label: "Missed Entry", maps_to: "be", icon: null }],
    });
    expect(result.breakEvens).toBe(1);
  });
});
