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

const CURRENT_SCHEMA_VERSION = 7;

/**
 * Run incremental migrations
 */
function runMigrations(sqlite: BetterSqlite3.Database, fromVersion: number): void {
  // Migration v1 -> v2: Add project analysis support
  if (fromVersion < 2) {
    console.log("Running migration v2: Add project analysis support");

    // Add new columns to projects table (if they don't exist)
    try {
      sqlite.exec("ALTER TABLE projects ADD COLUMN local_path TEXT");
    } catch {
      // Column already exists
    }
    try {
      sqlite.exec("ALTER TABLE projects ADD COLUMN last_analysis_at INTEGER");
    } catch {
      // Column already exists
    }

    // Add new columns to tasks table
    try {
      sqlite.exec("ALTER TABLE tasks ADD COLUMN plan_section_id TEXT");
    } catch {
      // Column already exists
    }
    try {
      sqlite.exec("ALTER TABLE tasks ADD COLUMN plan_item_index INTEGER");
    } catch {
      // Column already exists
    }

    setSchemaVersion(sqlite, 2, "Add project analysis support");
  }

  // Migration v2 -> v3: Update tasks table CHECK constraint for generated_by
  if (fromVersion < 3) {
    console.log("Running migration v3: Update tasks generated_by constraint");

    // SQLite doesn't support ALTER CHECK, so we recreate the table
    sqlite.exec(`
      -- Create new tasks table with updated constraint
      CREATE TABLE IF NOT EXISTS tasks_new (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('development', 'review', 'planning', 'maintenance', 'investigation', 'notification', 'documentation', 'security', 'improvement')),
        priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        context TEXT NOT NULL,
        suggested_actions TEXT NOT NULL DEFAULT '[]',
        related_issues TEXT NOT NULL DEFAULT '[]',
        related_prs TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_progress', 'completed', 'failed')),
        kanban_status TEXT NOT NULL DEFAULT 'not_started' CHECK (kanban_status IN ('not_started', 'backlog', 'in_progress', 'review', 'done')),
        generated_at INTEGER NOT NULL,
        completed_at INTEGER,
        approved_by TEXT CHECK (approved_by IS NULL OR approved_by IN ('telegram', 'web', 'auto')),
        generated_by TEXT CHECK (generated_by IS NULL OR generated_by IN ('health_check', 'deep_analysis', 'manual', 'chat', 'plan_sync')),
        plan_section_id TEXT,
        plan_item_index INTEGER
      );

      -- Copy data from old table
      INSERT INTO tasks_new SELECT * FROM tasks;

      -- Drop old table and rename new one
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_kanban_status ON tasks(kanban_status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_generated_at ON tasks(generated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
    `);

    setSchemaVersion(sqlite, 3, "Update tasks generated_by constraint");
  }

  // Migration v3 -> v4: Add plan_versions table for version history
  if (fromVersion < 4) {
    console.log("Running migration v4: Add plan_versions table");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS plan_versions (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        markdown TEXT NOT NULL,
        analysis_summary TEXT,
        change_summary TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON plan_versions(plan_id);
      CREATE INDEX IF NOT EXISTS idx_plan_versions_version ON plan_versions(plan_id, version DESC);
    `);

    setSchemaVersion(sqlite, 4, "Add plan_versions table");
  }

  // Migration v4 -> v5: Add GitHub Issue fields to tasks table
  if (fromVersion < 5) {
    console.log("Running migration v5: Add GitHub Issue fields");

    const columns = [
      "ALTER TABLE tasks ADD COLUMN github_issue_number INTEGER",
      "ALTER TABLE tasks ADD COLUMN github_issue_url TEXT",
      "ALTER TABLE tasks ADD COLUMN github_issue_state TEXT CHECK (github_issue_state IS NULL OR github_issue_state IN ('open', 'closed'))",
      "ALTER TABLE tasks ADD COLUMN github_issue_created_at INTEGER",
      "ALTER TABLE tasks ADD COLUMN github_issue_synced_at INTEGER"
    ];

    for (const sql of columns) {
      try {
        sqlite.exec(sql);
      } catch (error) {
        // Column already exists, skip
      }
    }

    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_github_issue ON tasks(github_issue_number);
      CREATE INDEX IF NOT EXISTS idx_tasks_github_issue_state ON tasks(github_issue_state);
    `);

    setSchemaVersion(sqlite, 5, "Add GitHub Issue fields");
  }

  // Migration v5 -> v6: Update kanban_status constraint to support all statuses
  if (fromVersion < 6) {
    console.log("Running migration v6: Update kanban_status constraint");

    // SQLite doesn't support ALTER CHECK, so we recreate the table
    sqlite.exec(`
      -- Create new tasks table with updated kanban_status constraint
      CREATE TABLE IF NOT EXISTS tasks_new (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('development', 'review', 'planning', 'maintenance', 'investigation', 'notification', 'documentation', 'security', 'improvement')),
        priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        context TEXT NOT NULL,
        suggested_actions TEXT NOT NULL DEFAULT '[]',
        related_issues TEXT NOT NULL DEFAULT '[]',
        related_prs TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_progress', 'completed', 'failed')),
        kanban_status TEXT NOT NULL DEFAULT 'not_started' CHECK (kanban_status IN ('not_started', 'backlog', 'in_progress', 'review', 'done')),
        generated_at INTEGER NOT NULL,
        completed_at INTEGER,
        approved_by TEXT CHECK (approved_by IS NULL OR approved_by IN ('telegram', 'web', 'auto')),
        generated_by TEXT CHECK (generated_by IS NULL OR generated_by IN ('health_check', 'deep_analysis', 'manual', 'chat', 'plan_sync')),
        plan_section_id TEXT,
        plan_item_index INTEGER,
        github_issue_number INTEGER,
        github_issue_url TEXT,
        github_issue_state TEXT CHECK (github_issue_state IS NULL OR github_issue_state IN ('open', 'closed')),
        github_issue_created_at INTEGER,
        github_issue_synced_at INTEGER
      );

      -- Copy data from old table
      INSERT INTO tasks_new SELECT * FROM tasks;

      -- Drop old table and rename new one
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_kanban_status ON tasks(kanban_status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_generated_at ON tasks(generated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_github_issue ON tasks(github_issue_number);
      CREATE INDEX IF NOT EXISTS idx_tasks_github_issue_state ON tasks(github_issue_state);
    `);

    setSchemaVersion(sqlite, 6, "Update kanban_status constraint to support all statuses");
  }

  // Migration v6 -> v7: Add team members and task assignment
  if (fromVersion < 7) {
    console.log("Running migration v7: Add team members and task assignment");

    // Add team_members table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        github_username TEXT,
        telegram_username TEXT,
        role TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('owner', 'admin', 'developer', 'designer', 'qa', 'viewer')),
        avatar_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
      CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(is_active);
      CREATE INDEX IF NOT EXISTS idx_team_members_github ON team_members(github_username);
      CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
    `);

    // Add project_team_members table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS project_team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        role TEXT CHECK (role IN ('owner', 'admin', 'developer', 'designer', 'qa', 'viewer')),
        joined_at INTEGER NOT NULL,
        UNIQUE(project_id, member_id)
      );

      CREATE INDEX IF NOT EXISTS idx_project_team_project ON project_team_members(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_team_member ON project_team_members(member_id);
    `);

    // Add assignment fields to tasks table
    try {
      sqlite.exec("ALTER TABLE tasks ADD COLUMN assigned_to TEXT REFERENCES team_members(id) ON DELETE SET NULL");
    } catch {
      // Column already exists
    }
    try {
      sqlite.exec("ALTER TABLE tasks ADD COLUMN assigned_at INTEGER");
    } catch {
      // Column already exists
    }

    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
    `);

    setSchemaVersion(sqlite, 7, "Add team members and task assignment");
  }
}

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

    if (currentVersion === 0) {
      // Fresh install - run full schema
      runSchema(sqlite, join(__dirname, "schema.sql"));
      setSchemaVersion(sqlite, CURRENT_SCHEMA_VERSION, "Initial schema with analysis support");
    } else {
      // Existing install - run incremental migrations
      runMigrations(sqlite, currentVersion);
      // Also run schema to create any new tables
      runSchema(sqlite, join(__dirname, "schema.sql"));
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
