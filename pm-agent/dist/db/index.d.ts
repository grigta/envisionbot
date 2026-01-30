/**
 * Database initialization and exports
 * Provides unified access to SQLite and Redis (with fallback)
 */
import type BetterSqlite3 from "better-sqlite3";
import { transaction } from "./sqlite.js";
import { type CacheClient, type PubSubClient, type RedisConfig } from "./redis.js";
export type DatabaseSync = BetterSqlite3.Database;
export interface DatabaseConfig {
    dataDir: string;
    redis?: RedisConfig;
}
export interface Database {
    sqlite: DatabaseSync;
    cache: CacheClient;
    pubsub: PubSubClient;
    isRedisConnected: boolean;
    close: () => Promise<void>;
}
/**
 * Initialize database connections
 */
export declare function initDatabase(config: DatabaseConfig): Promise<Database>;
export { transaction };
export type { CacheClient, PubSubClient };
export interface RepositoryDeps {
    db: DatabaseSync;
    cache: CacheClient;
    pubsub: PubSubClient;
}
//# sourceMappingURL=index.d.ts.map