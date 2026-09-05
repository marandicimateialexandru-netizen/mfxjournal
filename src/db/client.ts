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

async function migrate(db: Database): Promise<void> {
  for (const statement of splitStatements(schemaSql)) {
    await db.execute(statement);
  }
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
