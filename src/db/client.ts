import Database from "@tauri-apps/plugin-sql";
import schemaSql from "./schema.sql?raw";

let dbPromise: Promise<Database> | null = null;

/** Splits a .sql file into individual executable statements (naive but safe for our schema: no semicolons inside string literals). */
function splitStatements(sql: string): string[] {
  const withoutCommentLines = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutCommentLines
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Columns added after the initial release: applied via ALTER TABLE since CREATE TABLE IF NOT EXISTS won't touch existing tables. */
const COLUMN_MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  { table: "custom_results", column: "icon", ddl: "ALTER TABLE custom_results ADD COLUMN icon TEXT" },
  { table: "settings", column: "accounts_enabled", ddl: "ALTER TABLE settings ADD COLUMN accounts_enabled INTEGER NOT NULL DEFAULT 0" },
  { table: "settings", column: "streak_analysis_enabled", ddl: "ALTER TABLE settings ADD COLUMN streak_analysis_enabled INTEGER NOT NULL DEFAULT 0" },
  { table: "settings", column: "streak_be_breaks_streak", ddl: "ALTER TABLE settings ADD COLUMN streak_be_breaks_streak INTEGER NOT NULL DEFAULT 1" },
  { table: "settings", column: "variables_card_order", ddl: "ALTER TABLE settings ADD COLUMN variables_card_order TEXT" },
  { table: "custom_combinations", column: "display_settings", ddl: "ALTER TABLE custom_combinations ADD COLUMN display_settings TEXT" },
  { table: "trade_screenshots", column: "label", ddl: "ALTER TABLE trade_screenshots ADD COLUMN label TEXT" },
  { table: "settings", column: "ai_provider", ddl: "ALTER TABLE settings ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'claude'" },
  { table: "settings", column: "ollama_model", ddl: "ALTER TABLE settings ADD COLUMN ollama_model TEXT NOT NULL DEFAULT 'llama3.1'" },
  { table: "settings", column: "ollama_base_url", ddl: "ALTER TABLE settings ADD COLUMN ollama_base_url TEXT NOT NULL DEFAULT 'http://localhost:11434'" },
  { table: "settings", column: "groq_api_key", ddl: "ALTER TABLE settings ADD COLUMN groq_api_key TEXT" },
  { table: "settings", column: "groq_model", ddl: "ALTER TABLE settings ADD COLUMN groq_model TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile'" },
  { table: "workspaces", column: "profile_id", ddl: "ALTER TABLE workspaces ADD COLUMN profile_id TEXT REFERENCES profiles(id)" },
  { table: "profiles", column: "has_completed_tutorial", ddl: "ALTER TABLE profiles ADD COLUMN has_completed_tutorial INTEGER NOT NULL DEFAULT 0" },
  { table: "variable_templates", column: "profile_id", ddl: "ALTER TABLE variable_templates ADD COLUMN profile_id TEXT REFERENCES profiles(id)" },
  { table: "variables", column: "allow_multiple", ddl: "ALTER TABLE variables ADD COLUMN allow_multiple INTEGER NOT NULL DEFAULT 0" },
];

async function migrateColumns(db: Database): Promise<void> {
  for (const { table, column, ddl } of COLUMN_MIGRATIONS) {
    const info = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
    if (!info.some((c) => c.name === column)) {
      await db.execute(ddl);
    }
  }
}

/** Templates used to be scoped to the workspace they were saved from, so a template saved on one
 *  stat sheet silently didn't exist on any other — this backfills `profile_id` for any row saved
 *  before that changed, so existing templates immediately become visible across every stat sheet
 *  that profile owns, with nothing lost and nothing to recreate by hand. Safe to run every launch:
 *  only touches rows that still have no profile_id. */
async function backfillTemplateProfiles(db: Database): Promise<void> {
  await db.execute(
    `UPDATE variable_templates
     SET profile_id = (SELECT profile_id FROM workspaces WHERE workspaces.id = variable_templates.workspace_id)
     WHERE profile_id IS NULL`,
  );
}

/** Liquidity and News are the only two variables that ever get `allow_multiple` set — this flips it
 *  on for any install's pre-existing rows (matched by `key`, which is stable even if the user renamed
 *  the display label), so upgrading the app is what grants multi-tagging, not recreating the variable.
 *  Safe every launch: only ever turns the flag on, never off, so re-running is a no-op once applied. */
async function backfillMultiTagVariables(db: Database): Promise<void> {
  await db.execute("UPDATE variables SET allow_multiple = 1 WHERE key IN ('liquidity', 'news') AND allow_multiple = 0");
}

/** `trade_variable_values` used to be keyed `(trade_id, variable_id)`, which is exactly the
 *  constraint that made multi-tagging impossible — a second tagged value for the same variable on
 *  the same trade would just overwrite the first. `CREATE TABLE IF NOT EXISTS` in schema.sql only
 *  affects brand-new installs (which get the 3-column PK directly); an existing table keeps its old
 *  PK forever unless rebuilt, which is what this does, once, the first launch after upgrading.
 *  Detected via `PRAGMA table_info`'s `pk` column (1-indexed position within the primary key, 0 if
 *  not part of it) rather than string-matching the stored schema text, since that's what actually
 *  changed. */
async function migrateTradeVariableValuesPk(db: Database): Promise<void> {
  const info = await db.select<{ name: string; pk: number }[]>("PRAGMA table_info(trade_variable_values)");
  const pkColumnCount = info.filter((c) => c.pk > 0).length;
  if (pkColumnCount !== 2) return; // already migrated (3), or table doesn't exist yet (0, handled by CREATE TABLE)

  await db.execute(`
    CREATE TABLE trade_variable_values_v2 (
      trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
      variable_id TEXT NOT NULL REFERENCES variables(id),
      value_id TEXT REFERENCES variable_values(id),
      number_value REAL,
      PRIMARY KEY (trade_id, variable_id, value_id)
    )
  `);
  await db.execute(`
    INSERT OR IGNORE INTO trade_variable_values_v2 (trade_id, variable_id, value_id, number_value)
    SELECT trade_id, variable_id, value_id, number_value FROM trade_variable_values
  `);
  await db.execute("DROP TABLE trade_variable_values");
  await db.execute("ALTER TABLE trade_variable_values_v2 RENAME TO trade_variable_values");
}

async function migrate(db: Database): Promise<void> {
  for (const statement of splitStatements(schemaSql)) {
    await db.execute(statement);
  }
  await migrateColumns(db);
  await migrateTradeVariableValuesPk(db);
  await backfillTemplateProfiles(db);
  await backfillMultiTagVariables(db);
}

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:mfxjournal.db");
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function select<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(query, params);
}

export async function execute(
  query: string,
  params: unknown[] = [],
): Promise<void> {
  const db = await getDb();
  await db.execute(query, params);
}
