/**
 * SQLite connection using better-sqlite3
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SQLiteConfig {
  dataDir: string;
  filename?: string;
}

export interface SQLiteConnection {
  db: Database.Database;
  close: () => void;
}

/**
 * Initialize SQLite database connection
 */
export function initSQLite(config: SQLiteConfig): SQLiteConnection {
  const { dataDir, filename = "pm-agent.db" } = config;

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, filename);
  const db = new Database(dbPath);

  // Enable foreign keys and WAL mode for better performance
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  return {
    db,
    close: () => db.close(),
  };
}

/**
 * Run SQL schema file
 */
export function runSchema(db: Database.Database, schemaPath: string): void {
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
}

/**
 * Check if a table exists
 */
export function tableExists(db: Database.Database, tableName: string): boolean {
  const stmt = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  );
  const result = stmt.get(tableName);
  return result !== undefined;
}

/**
 * Get current schema version
 */
export function getSchemaVersion(db: Database.Database): number {
  if (!tableExists(db, "schema_migrations")) {
    return 0;
  }

  const stmt = db.prepare(
    "SELECT MAX(version) as version FROM schema_migrations"
  );
  const result = stmt.get() as { version: number | null } | undefined;
  return result?.version ?? 0;
}

/**
 * Set schema version
 */
export function setSchemaVersion(
  db: Database.Database,
  version: number,
  description: string
): void {
  const stmt = db.prepare(
    "INSERT INTO schema_migrations (version, description) VALUES (?, ?)"
  );
  stmt.run(version, description);
}

/**
 * Transaction helper
 */
export function transaction<T>(db: Database.Database, fn: () => T): T {
  return db.transaction(fn)();
}

export type { Database };
