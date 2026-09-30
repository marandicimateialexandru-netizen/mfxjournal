import { select, execute } from "./client";
import { createVariable, addVariableValue, type VariableWithValues } from "./queries/variables";
import { createTrade } from "./queries/trades";
import { ensureDefaultStreakThresholds } from "./queries/streakThresholds";
import { PERSONAL_VARIABLE_SET } from "@/features/variables/personalVariableSet";

/** Ships the user's real variable taxonomy plus a handful of sample trades so the app isn't empty on first launch. */
export async function seedIfEmpty(workspaceId: string): Promise<void> {
  const existingVars = await select<{ n: number }>(
    "SELECT COUNT(*) as n FROM variables WHERE workspace_id = ?",
    [workspaceId],
  );
  if ((existingVars[0]?.n ?? 0) > 0) return;

  await ensureDefaultStreakThresholds(workspaceId);

  const byKey = new Map<string, VariableWithValues>();
  for (const v of PERSONAL_VARIABLE_SET.variables) {
    const created = await createVariable(workspaceId, { key: v.key, label: v.label, type: v.type, icon: v.icon });
    const values = await Promise.all(v.values.map((val) => addVariableValue(created.id, val.label, { icon: val.icon ?? undefined })));
    byKey.set(v.key, { ...created, values });
  }

  const setup = byKey.get("setup")!;
  const session = byKey.get("session")!;
  const news = byKey.get("news")!;
  const direction = byKey.get("direction")!;
  const setupValues = setup.values;
  const sessionValues = session.values;
  const newsValues = news.values;
  const directionValues = direction.values;

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
      variableValues: {
        [setup.id]: { valueId: setupValues[0].id },
        [session.id]: { valueId: sessionValues[0].id },
        [news.id]: { valueId: newsValues[0].id },
        [direction.id]: { valueId: directionValues[0].id },
      },
    },
    {
      entry_time: daysAgo(7, 10),
      outcome: "loss" as const,
      risk_r: 1,
      result_r: -1,
      market: "GBPUSD",
      notes: "TG held then failed straight into a US CPI print. Should have skipped it.",
      variableValues: {
        [setup.id]: { valueId: setupValues[1].id },
        [session.id]: { valueId: sessionValues[1].id },
        [news.id]: { valueId: newsValues[5].id },
        [direction.id]: { valueId: directionValues[1].id },
      },
    },
    {
      entry_time: daysAgo(5, 4),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 1.8,
      market: "USDJPY",
      notes: "SLG+3CG liquidity sweep in the evening session, quick reversal into the fill.",
      variableValues: {
        [setup.id]: { valueId: setupValues[9].id },
        [session.id]: { valueId: sessionValues[2].id },
        [news.id]: { valueId: newsValues[0].id },
        [direction.id]: { valueId: directionValues[0].id },
      },
    },
    {
      entry_time: daysAgo(3, 8),
      outcome: "be" as const,
      risk_r: 1,
      result_r: 0,
      market: "EURUSD",
      notes: "Scratched at breakeven when structure invalidated early.",
      variableValues: {
        [setup.id]: { valueId: setupValues[2].id },
        [session.id]: { valueId: sessionValues[0].id },
        [news.id]: { valueId: newsValues[8].id },
        [direction.id]: { valueId: directionValues[1].id },
      },
    },
    {
      entry_time: daysAgo(1, 9),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 3.1,
      market: "XAUUSD",
      notes: "3G confirmation into the day session, best trade of the week.",
      variableValues: {
        [setup.id]: { valueId: setupValues[3].id },
        [session.id]: { valueId: sessionValues[1].id },
        [news.id]: { valueId: newsValues[0].id },
        [direction.id]: { valueId: directionValues[0].id },
      },
    },
    {
      entry_time: daysAgo(14, 8),
      outcome: "loss" as const,
      risk_r: 1,
      result_r: -1,
      market: "GBPUSD",
      notes: "3CG into the No Session window, chopped around and stopped out clean.",
      variableValues: {
        [setup.id]: { valueId: setupValues[4].id },
        [session.id]: { valueId: sessionValues[2].id },
        [news.id]: { valueId: newsValues[3].id },
        [direction.id]: { valueId: directionValues[1].id },
      },
    },
    {
      entry_time: daysAgo(12, 11),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 2.2,
      market: "XAUUSD",
      notes: "SLG+OG off the London open, sized up on a clean displacement leg.",
      variableValues: {
        [setup.id]: { valueId: setupValues[5].id },
        [session.id]: { valueId: sessionValues[0].id },
        [news.id]: { valueId: newsValues[7].id },
        [direction.id]: { valueId: directionValues[0].id },
      },
    },
    {
      entry_time: daysAgo(10, 9),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 1.6,
      market: "EURUSD",
      notes: "SLG+TG on the New York open, took partial and trailed the rest.",
      variableValues: {
        [setup.id]: { valueId: setupValues[6].id },
        [session.id]: { valueId: sessionValues[1].id },
        [news.id]: { valueId: newsValues[0].id },
        [direction.id]: { valueId: directionValues[1].id },
      },
    },
    {
      entry_time: daysAgo(6, 10),
      outcome: "be" as const,
      risk_r: 1,
      result_r: 0,
      market: "USDJPY",
      notes: "SLG+TCG right before Fed Speech — flattened early rather than hold through it.",
      variableValues: {
        [setup.id]: { valueId: setupValues[7].id },
        [session.id]: { valueId: sessionValues[2].id },
        [news.id]: { valueId: newsValues[9].id },
        [direction.id]: { valueId: directionValues[0].id },
      },
    },
    {
      entry_time: daysAgo(2, 9),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 1.9,
      market: "GBPUSD",
      notes: "SLG+3G off a local liquidity grab, textbook follow-through to target.",
      variableValues: {
        [setup.id]: { valueId: setupValues[8].id },
        [session.id]: { valueId: sessionValues[0].id },
        [news.id]: { valueId: newsValues[0].id },
        [direction.id]: { valueId: directionValues[1].id },
      },
    },
  ];

  for (const t of sampleTrades) {
    await createTrade(workspaceId, { ...t, is_seed: true });
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
