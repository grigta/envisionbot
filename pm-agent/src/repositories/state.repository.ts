/**
 * Agent State Repository
 * Key-value store for global agent state
 */

import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

interface StateRow {
  key: string;
  value: string;
  updated_at: number;
}

export class StateRepository extends BaseRepository<unknown> {
  protected readonly tableName = "agent_state";
  protected readonly cachePrefix = "pm:state";
  protected readonly cacheTTL = 60; // 1 minute
  protected readonly pubsubChannel = "pm:events:analysis" as const;

  async get<T>(key: string): Promise<T | undefined> {
    const cacheKey = `${this.cachePrefix}:${key}`;
    const cached = await this.getFromCache<T>(cacheKey);
    if (cached !== null) return cached;

    const stmt = this.db.prepare("SELECT value FROM agent_state WHERE key = ?");
    const row = stmt.get(key) as Pick<StateRow, "value"> | undefined;

    if (row) {
      const value = JSON.parse(row.value) as T;
      await this.setCache(cacheKey, value);
      return value;
    }

    return undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO agent_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    stmt.run(key, JSON.stringify(value), Date.now());
    await this.invalidateCache(`${this.cachePrefix}:${key}`);
  }

  async delete(key: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM agent_state WHERE key = ?");
    const result = stmt.run(key);

    if (result.changes > 0) {
      await this.invalidateCache(`${this.cachePrefix}:${key}`);
      return true;
    }

    return false;
  }

  // Convenience methods for common state values

  async getLastHealthCheck(): Promise<number | undefined> {
    return this.get<number>("lastHealthCheck");
  }

  async setLastHealthCheck(timestamp: number): Promise<void> {
    await this.set("lastHealthCheck", timestamp);
  }

  async getLastDeepAnalysis(): Promise<number | undefined> {
    return this.get<number>("lastDeepAnalysis");
  }

  async setLastDeepAnalysis(timestamp: number): Promise<void> {
    await this.set("lastDeepAnalysis", timestamp);
  }

  async isMigrationCompleted(): Promise<boolean> {
    const value = await this.get<string>("migration_completed");
    return value === "true";
  }

  async setMigrationCompleted(): Promise<void> {
    await this.set("migration_completed", "true");
  }

  async getCurrentChatSessionId(): Promise<string | undefined> {
    return this.get<string>("currentChatSessionId");
  }

  async setCurrentChatSessionId(sessionId: string): Promise<void> {
    await this.set("currentChatSessionId", sessionId);
  }

  // Stats helper
  async getStats(deps: {
    projectCount: number;
    taskCount: number;
    pendingActionsCount: number;
    ideaCount: number;
    activeIdeasCount: number;
  }): Promise<{
    projectCount: number;
    taskCount: number;
    pendingActionsCount: number;
    ideaCount: number;
    activeIdeasCount: number;
    lastHealthCheck?: number;
    lastDeepAnalysis?: number;
  }> {
    const [lastHealthCheck, lastDeepAnalysis] = await Promise.all([
      this.getLastHealthCheck(),
      this.getLastDeepAnalysis(),
    ]);

    return {
      ...deps,
      lastHealthCheck,
      lastDeepAnalysis,
    };
  }
}
