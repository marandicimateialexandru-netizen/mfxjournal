import { describe, it, expect } from "vitest";
import { marketBuckets, streakBuckets } from "../pseudoVariables";
import type { Trade, Market, StreakThreshold } from "@/db/types";

function trade(id: string, day: number, outcome: Trade["outcome"], market = "EURUSD"): Trade {
  return {
    id,
    workspace_id: "ws1",
    strategy_id: null,
    account_id: null,
    entry_time: new Date(2026, 0, day, 9, 0).toISOString(),
    end_time: null,
    outcome,
    risk_r: 1,
    result_r: outcome === "win" ? 1 : outcome === "loss" ? -1 : 0,
    market,
    notes: null,
    is_seed: 0,
    created_at: new Date(2026, 0, day).toISOString(),
    updated_at: new Date(2026, 0, day).toISOString(),
  };
}

describe("marketBuckets", () => {
  const markets: Market[] = [
    { id: "m1", workspace_id: "ws1", symbol: "EURUSD" },
    { id: "m2", workspace_id: "ws1", symbol: "GBPUSD" },
  ];

  it("buckets trades by matching market symbol, one bucket per configured market", () => {
    const trades = [
      trade("t1", 1, "win", "EURUSD"),
      trade("t2", 2, "loss", "GBPUSD"),
      trade("t3", 3, "win", "EURUSD"),
    ];
    const buckets = marketBuckets(trades, markets);
    expect(buckets).toHaveLength(2);
    expect(buckets.find((b) => b.valueId === "EURUSD")?.tradeCount).toBe(2);
    expect(buckets.find((b) => b.valueId === "GBPUSD")?.tradeCount).toBe(1);
  });

  it("ignores trades whose market isn't a configured Market", () => {
    const trades = [trade("t1", 1, "win", "XAUUSD")];
    const buckets = marketBuckets(trades, markets);
    expect(buckets.every((b) => b.tradeCount === 0)).toBe(true);
  });
});

describe("streakBuckets", () => {
  // win, win, loss, be, win, loss, loss, win, be, win
  const FIXTURE: Trade[] = [
    trade("t1", 1, "win"),
    trade("t2", 2, "win"),
    trade("t3", 3, "loss"),
    trade("t4", 4, "be"),
    trade("t5", 5, "win"),
    trade("t6", 6, "loss"),
    trade("t7", 7, "loss"),
    trade("t8", 8, "win"),
    trade("t9", 9, "be"),
    trade("t10", 10, "win"),
  ];
  const thresholds: StreakThreshold[] = [{ id: "th1", workspace_id: "ws1", threshold: 2, be_breaks_streak: 1 }];

  it("buckets 'After BE' as trades immediately following a break-even trade", () => {
    const buckets = streakBuckets(FIXTURE, { thresholds, beBreaksStreak: true });
    const afterBe = buckets.find((b) => b.valueId === "after_be")!;
    expect(afterBe.tradeCount).toBe(2); // t5 (after t4 be), t10 (after t9 be)
    expect(afterBe.winRatePct).toBe(100);
  });

  it("buckets 'No Prior Streak' as trades with no qualifying win/loss run and not after a BE", () => {
    const buckets = streakBuckets(FIXTURE, { thresholds, beBreaksStreak: true });
    const noStreak = buckets.find((b) => b.valueId === "no_streak")!;
    expect(noStreak.tradeCount).toBe(6); // t1, t2, t4, t6, t7, t9
  });

  it("buckets 'After N+ Win/Loss Streak' per configured threshold", () => {
    const buckets = streakBuckets(FIXTURE, { thresholds, beBreaksStreak: true });
    const afterWin2 = buckets.find((b) => b.valueId === "after_win_2")!;
    const afterLoss2 = buckets.find((b) => b.valueId === "after_loss_2")!;
    expect(afterWin2.tradeCount).toBe(1); // t3 comes after 2 prior wins
    expect(afterLoss2.tradeCount).toBe(1); // t8 comes after 2 prior losses
    expect(afterWin2.label).toBe("After 2+ Win Streak");
    expect(afterLoss2.label).toBe("After 2+ Loss Streak");
  });

  it("respects beBreaksStreak: a streak survives a BE trade when false", () => {
    const short: Trade[] = [trade("a", 1, "win"), trade("b", 2, "be"), trade("c", 3, "win")];
    const oneThreshold: StreakThreshold[] = [{ id: "th1", workspace_id: "ws1", threshold: 1, be_breaks_streak: 0 }];

    const broken = streakBuckets(short, { thresholds: oneThreshold, beBreaksStreak: true });
    expect(broken.find((b) => b.valueId === "after_win_1")!.tradeCount).toBe(1); // only the BE trade itself

    const carried = streakBuckets(short, { thresholds: oneThreshold, beBreaksStreak: false });
    expect(carried.find((b) => b.valueId === "after_win_1")!.tradeCount).toBe(2); // BE trade + the win after it
  });

  it("handles an empty thresholds list gracefully", () => {
    const buckets = streakBuckets(FIXTURE, { thresholds: [], beBreaksStreak: true });
    expect(buckets.map((b) => b.valueId)).toEqual(["no_streak", "after_be"]);
  });
});
