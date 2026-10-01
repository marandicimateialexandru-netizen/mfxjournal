import { select, execute } from "./client";
import { createVariable, addVariableValue, type VariableWithValues } from "./queries/variables";
import { createTrade } from "./queries/trades";
import { ensureDefaultStreakThresholds } from "./queries/streakThresholds";
import { PERSONAL_VARIABLE_SET } from "@/features/variables/personalVariableSet";

/** Creates every variable (and its values/icons) from the personal taxonomy on a workspace that has
 *  none yet — the variable-only half of `seedIfEmpty` below, factored out so a freshly-created
 *  workspace (via "+ New Stat Sheet") can get the same taxonomy immediately without also getting
 *  seedIfEmpty's ten fake demo trades, which only make sense on a profile's very first workspace,
 *  not on a new sheet meant to track real trades from day one. Returns the created variables keyed
 *  by their `key`, for callers (like seedIfEmpty) that still need to reference specific ones. */
export async function seedPersonalTaxonomy(workspaceId: string): Promise<Map<string, VariableWithValues>> {
  const byKey = new Map<string, VariableWithValues>();
  const existingVars = await select<{ n: number }>(
    "SELECT COUNT(*) as n FROM variables WHERE workspace_id = ?",
    [workspaceId],
  );
  if ((existingVars[0]?.n ?? 0) > 0) return byKey;

  for (const v of PERSONAL_VARIABLE_SET.variables) {
    const created = await createVariable(workspaceId, { key: v.key, label: v.label, type: v.type, icon: v.icon, allowMultiple: v.allowMultiple });
    const values = await Promise.all(v.values.map((val) => addVariableValue(created.id, val.label, { icon: val.icon ?? undefined })));
    byKey.set(v.key, { ...created, values });
  }
  return byKey;
}

/** Ships the user's real variable taxonomy plus a handful of sample trades so the app isn't empty on first launch. */
export async function seedIfEmpty(workspaceId: string): Promise<void> {
  const byKey = await seedPersonalTaxonomy(workspaceId);
  if (byKey.size === 0) return;

  await ensureDefaultStreakThresholds(workspaceId);

  const daysAgo = (n: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  const sampleTrades = [
    {
      entry_time: daysAgo(9, 9),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 2.4,
      market: "EURUSD",
      notes: "Clean OSG entry off the morning liquidity sweep, held for target.",
    },
    {
      entry_time: daysAgo(7, 10),
      outcome: "loss" as const,
      risk_r: 1,
      result_r: -1,
      market: "GBPUSD",
      notes: "TG held then failed straight into a US CPI print. Should have skipped it.",
    },
    {
      entry_time: daysAgo(5, 4),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 1.8,
      market: "USDJPY",
      notes: "SLG+3CG liquidity sweep in the evening session, quick reversal into the fill.",
    },
    {
      entry_time: daysAgo(3, 8),
      outcome: "be" as const,
      risk_r: 1,
      result_r: 0,
      market: "EURUSD",
      notes: "Scratched at breakeven when structure invalidated early.",
    },
    {
      entry_time: daysAgo(1, 9),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 3.1,
      market: "XAUUSD",
      notes: "3G confirmation into the day session, best trade of the week.",
    },
    {
      entry_time: daysAgo(14, 8),
      outcome: "loss" as const,
      risk_r: 1,
      result_r: -1,
      market: "GBPUSD",
      notes: "3CG into the No Session window, chopped around and stopped out clean.",
    },
    {
      entry_time: daysAgo(12, 11),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 2.2,
      market: "XAUUSD",
      notes: "SLG+OG off the London open, sized up on a clean displacement leg.",
    },
    {
      entry_time: daysAgo(10, 9),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 1.6,
      market: "EURUSD",
      notes: "SLG+TG on the New York open, took partial and trailed the rest.",
    },
    {
      entry_time: daysAgo(6, 10),
      outcome: "be" as const,
      risk_r: 1,
      result_r: 0,
      market: "USDJPY",
      notes: "SLG+TCG right before Fed Speech — flattened early rather than hold through it.",
    },
    {
      entry_time: daysAgo(2, 9),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 1.9,
      market: "GBPUSD",
      notes: "SLG+3G off a local liquidity grab, textbook follow-through to target.",
    },
  ];

  // Every sample trade gets a value for EVERY seeded variable (not just the 4 the notes above
  // narrate), round-robining through each variable's own value list by trade index — so a fresh
  // install shows all ten variable categories with real win-rate data immediately, on the Dashboard
  // and everywhere else, instead of only the ones a trade happens to mention. A variable with zero
  // tagged trades renders no card at all (see `WinRateCard`), which is what "half my variables
  // disappeared" turned out to be the first time this was narrower.
  for (const [i, t] of sampleTrades.entries()) {
    const variableValues: Record<string, { valueId: string }> = {};
    for (const v of byKey.values()) {
      if (v.values.length === 0) continue;
      variableValues[v.id] = { valueId: v.values[i % v.values.length].id };
    }
    await createTrade(workspaceId, { ...t, variableValues, is_seed: true });
  }
}

export async function countTestTrades(workspaceId: string): Promise<number> {
  const rows = await select<{ n: number }>(
    "SELECT COUNT(*) as n FROM trades WHERE workspace_id = ? AND is_seed = 1",
    [workspaceId],
  );
  return rows[0]?.n ?? 0;
}

export async function deleteTestTrades(workspaceId: string): Promise<number> {
  const count = await countTestTrades(workspaceId);
  await execute("DELETE FROM trades WHERE workspace_id = ? AND is_seed = 1", [workspaceId]);
  return count;
}
