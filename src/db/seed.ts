import { select, execute } from "./client";
import { createVariable, addVariableValue } from "./queries/variables";
import { createTrade } from "./queries/trades";
import { ensureDefaultStreakThresholds } from "./queries/streakThresholds";

/** Ships a sensible default ICT/SMC-style Variable schema plus a handful of sample trades so the app isn't empty on first launch. */
export async function seedIfEmpty(workspaceId: string): Promise<void> {
  const existingVars = await select<{ n: number }>(
    "SELECT COUNT(*) as n FROM variables WHERE workspace_id = ?",
    [workspaceId],
  );
  if ((existingVars[0]?.n ?? 0) > 0) return;

  await ensureDefaultStreakThresholds(workspaceId);

  const setup = await createVariable(workspaceId, { key: "setup", label: "Setup", type: "text", icon: "🎯" });
  const setupValues = await Promise.all(
    ["OTE", "Order Block", "FVG", "BOS", "Liquidity Sweep"].map((label) =>
      addVariableValue(setup.id, label),
    ),
  );

  const session = await createVariable(workspaceId, { key: "session", label: "Session", type: "text", icon: "🕐" });
  const sessionValues = await Promise.all(
    ["Asian", "London", "New York"].map((label) => addVariableValue(session.id, label)),
  );

  const news = await createVariable(workspaceId, { key: "news", label: "News", type: "text", icon: "📰" });
  const newsValues = await Promise.all(
    ["High Impact", "Medium Impact", "None"].map((label) => addVariableValue(news.id, label)),
  );

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
      notes: "Clean OTE entry off the London open sweep, held for target.",
      variableValues: {
        [setup.id]: { valueId: setupValues[0].id },
        [session.id]: { valueId: sessionValues[1].id },
        [news.id]: { valueId: newsValues[2].id },
      },
    },
    {
      entry_time: daysAgo(7, 10),
      outcome: "loss" as const,
      risk_r: 1,
      result_r: -1,
      market: "GBPUSD",
      notes: "Order block held then failed on a red folder headline. Should have skipped it.",
      variableValues: {
        [setup.id]: { valueId: setupValues[1].id },
        [session.id]: { valueId: sessionValues[1].id },
        [news.id]: { valueId: newsValues[0].id },
      },
    },
    {
      entry_time: daysAgo(5, 4),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 1.8,
      market: "USDJPY",
      notes: "Asian session liquidity sweep, quick reversal into FVG fill.",
      variableValues: {
        [setup.id]: { valueId: setupValues[4].id },
        [session.id]: { valueId: sessionValues[0].id },
        [news.id]: { valueId: newsValues[2].id },
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
        [session.id]: { valueId: sessionValues[1].id },
        [news.id]: { valueId: newsValues[1].id },
      },
    },
    {
      entry_time: daysAgo(1, 9),
      outcome: "win" as const,
      risk_r: 1,
      result_r: 3.1,
      market: "XAUUSD",
      notes: "BOS confirmation into New York open, best trade of the week.",
      variableValues: {
        [setup.id]: { valueId: setupValues[3].id },
        [session.id]: { valueId: sessionValues[2].id },
        [news.id]: { valueId: newsValues[2].id },
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
