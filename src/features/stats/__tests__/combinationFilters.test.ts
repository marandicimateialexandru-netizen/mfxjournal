import { describe, it, expect } from "vitest";
import { buildCombinationVariableOptions, tradeMatchesFilter, applyCombinationFilters } from "../combinationFilters";
import type { Trade, Market } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

function trade(id: string, entry: Date, market: string | null, variableValues?: Trade["variableValues"]): Trade {
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
    entry_time: entry.toISOString(),
    end_time: null,
    outcome: "win",
    risk_r: 1,
    result_r: 1,
    market,
    notes: null,
    is_seed: 0,
    created_at: entry.toISOString(),
    updated_at: entry.toISOString(),
    variableValues: normalized,
  };
}

const DIRECTION: VariableWithValues = {
  id: "var-direction",
  workspace_id: "ws1",
  key: "direction",
  label: "Direction",
  type: "text",
  icon: null,
  sort_order: 0,
  allow_multiple: 0,
  values: [
    { id: "val-buy", variable_id: "var-direction", label: "Buy", icon: null, color: null, sort_order: 0 },
    { id: "val-sell", variable_id: "var-direction", label: "Sell", icon: null, color: null, sort_order: 1 },
  ],
};

const NUMBER_VAR: VariableWithValues = { ...DIRECTION, id: "var-size", type: "number", values: [] };

const MARKETS: Market[] = [{ id: "m1", workspace_id: "ws1", symbol: "EURUSD" }];

describe("buildCombinationVariableOptions", () => {
  it("includes Months, Days of Week, Time of Day, Market, then text variables only, in order", () => {
    const options = buildCombinationVariableOptions([DIRECTION, NUMBER_VAR], MARKETS);
    expect(options.map((o) => o.id)).toEqual(["months", "days_of_week", "time_of_day", "market", "var-direction"]);
    expect(options.find((o) => o.id === "months")!.values).toHaveLength(12);
    expect(options.find((o) => o.id === "days_of_week")!.values).toHaveLength(7);
    expect(options.find((o) => o.id === "time_of_day")!.values).toHaveLength(24);
    expect(options.find((o) => o.id === "market")!.values.map((v) => v.id)).toEqual(["EURUSD"]);
    expect(options.find((o) => o.id === "var-direction")!.values.map((v) => v.label)).toEqual(["Buy", "Sell"]);
  });
});

describe("tradeMatchesFilter", () => {
  const buyTrade = trade("t1", new Date(2026, 0, 5, 9, 0), "EURUSD", { "var-direction": { valueId: "val-buy" } }); // Monday
  const sellTrade = trade("t2", new Date(2026, 0, 5, 9, 0), "GBPUSD", { "var-direction": { valueId: "val-sell" } });

  it("matches a custom variable filter (Include)", () => {
    expect(tradeMatchesFilter(buyTrade, { variableId: "var-direction", include: true, valueIds: ["val-buy"] })).toBe(true);
    expect(tradeMatchesFilter(sellTrade, { variableId: "var-direction", include: true, valueIds: ["val-buy"] })).toBe(false);
  });

  it("inverts the match for Exclude", () => {
    expect(tradeMatchesFilter(buyTrade, { variableId: "var-direction", include: false, valueIds: ["val-buy"] })).toBe(false);
    expect(tradeMatchesFilter(sellTrade, { variableId: "var-direction", include: false, valueIds: ["val-buy"] })).toBe(true);
  });

  it("matches Market by trade.market symbol", () => {
    expect(tradeMatchesFilter(buyTrade, { variableId: "market", include: true, valueIds: ["EURUSD"] })).toBe(true);
    expect(tradeMatchesFilter(sellTrade, { variableId: "market", include: true, valueIds: ["EURUSD"] })).toBe(false);
  });

  it("matches Days of Week by getDay()", () => {
    // 2026-01-05 is a Monday (day index 1)
    expect(tradeMatchesFilter(buyTrade, { variableId: "days_of_week", include: true, valueIds: ["1"] })).toBe(true);
    expect(tradeMatchesFilter(buyTrade, { variableId: "days_of_week", include: true, valueIds: ["2"] })).toBe(false);
  });
});

describe("applyCombinationFilters", () => {
  const t1 = trade("t1", new Date(2026, 0, 5, 9, 0), "EURUSD", { "var-direction": { valueId: "val-buy" } });
  const t2 = trade("t2", new Date(2026, 0, 5, 9, 0), "EURUSD", { "var-direction": { valueId: "val-sell" } });
  const t3 = trade("t3", new Date(2026, 0, 5, 9, 0), "GBPUSD", { "var-direction": { valueId: "val-buy" } });

  it("ANDs multiple filters together", () => {
    const result = applyCombinationFilters([t1, t2, t3], [
      { variableId: "market", include: true, valueIds: ["EURUSD"] },
      { variableId: "var-direction", include: true, valueIds: ["val-buy"] },
    ]);
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("combines Include and Exclude filters", () => {
    const result = applyCombinationFilters([t1, t2, t3], [
      { variableId: "market", include: true, valueIds: ["EURUSD"] },
      { variableId: "var-direction", include: false, valueIds: ["val-buy"] },
    ]);
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });

  it("returns an empty list when there are no filters", () => {
    expect(applyCombinationFilters([t1, t2, t3], [])).toEqual([]);
  });
});
