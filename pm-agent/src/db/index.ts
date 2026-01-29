/**
 * Database initialization and exports
 * Provides unified access to SQLite and Redis (with fallback)
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type BetterSqlite3 from "better-sqlite3";
import {
  initSQLite,
  runSchema,
  getSchemaVersion,
  setSchemaVersion,
  transaction,
} from "./sqlite.js";
import {
  initRedis,
  type CacheClient,
  type PubSubClient,
  type RedisConfig,
} from "./redis.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Re-export better-sqlite3 Database type
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

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Initialize database connections
 */
export async function initDatabase(config: DatabaseConfig): Promise<Database> {
  const { dataDir, redis: redisConfig } = config;

  // Initialize SQLite
  const sqliteConn = initSQLite({ dataDir });
  const { db: sqlite } = sqliteConn;

  // Run schema if needed
  const currentVersion = getSchemaVersion(sqlite);
  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    console.log(
      `Upgrading database schema from v${currentVersion} to v${CURRENT_SCHEMA_VERSION}`
    );
    runSchema(sqlite, join(__dirname, "schema.sql"));
    if (currentVersion === 0) {
      setSchemaVersion(sqlite, CURRENT_SCHEMA_VERSION, "Initial schema");
    }
  }

  // Initialize Redis (with fallback)
  const redisConn = await initRedis(redisConfig);

  return {
    sqlite,
    cache: redisConn.cache,
    pubsub: redisConn.pubsub,
    isRedisConnected: redisConn.isConnected,
    close: async () => {
      sqliteConn.close();
      await redisConn.close();
    },
  };
}

// Re-export utilities
export { transaction };
export type { CacheClient, PubSubClient };

// Re-export types for repositories
export interface RepositoryDeps {
  db: DatabaseSync;
  cache: CacheClient;
  pubsub: PubSubClient;
}
