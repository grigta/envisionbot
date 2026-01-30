/**
 * SQLite connection using better-sqlite3
 */
import Database from "better-sqlite3";
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
export declare function initSQLite(config: SQLiteConfig): SQLiteConnection;
/**
 * Run SQL schema file
 */
export declare function runSchema(db: Database.Database, schemaPath: string): void;
/**
 * Check if a table exists
 */
export declare function tableExists(db: Database.Database, tableName: string): boolean;
/**
 * Get current schema version
 */
export declare function getSchemaVersion(db: Database.Database): number;
/**
 * Set schema version
 */
export declare function setSchemaVersion(db: Database.Database, version: number, description: string): void;
/**
 * Transaction helper
 */
export declare function transaction<T>(db: Database.Database, fn: () => T): T;
export type { Database };
//# sourceMappingURL=sqlite.d.ts.map