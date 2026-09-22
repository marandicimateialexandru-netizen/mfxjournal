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
];

async function migrateColumns(db: Database): Promise<void> {
  for (const { table, column, ddl } of COLUMN_MIGRATIONS) {
    const info = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
    if (!info.some((c) => c.name === column)) {
      await db.execute(ddl);
    }
  }
}

async function migrate(db: Database): Promise<void> {
  for (const statement of splitStatements(schemaSql)) {
    await db.execute(statement);
  }
  await migrateColumns(db);
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
