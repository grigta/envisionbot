/**
 * Agent State Repository
 * Key-value store for global agent state
 */
import { BaseRepository } from "./base.repository.js";
export class StateRepository extends BaseRepository {
    tableName = "agent_state";
    cachePrefix = "pm:state";
    cacheTTL = 60; // 1 minute
    pubsubChannel = "pm:events:analysis";
    async get(key) {
        const cacheKey = `${this.cachePrefix}:${key}`;
        const cached = await this.getFromCache(cacheKey);
        if (cached !== null)
            return cached;
        const stmt = this.db.prepare("SELECT value FROM agent_state WHERE key = ?");
        const row = stmt.get(key);
        if (row) {
            const value = JSON.parse(row.value);
            await this.setCache(cacheKey, value);
            return value;
        }
        return undefined;
    }
    async set(key, value) {
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
    async delete(key) {
        const stmt = this.db.prepare("DELETE FROM agent_state WHERE key = ?");
        const result = stmt.run(key);
        if (result.changes > 0) {
            await this.invalidateCache(`${this.cachePrefix}:${key}`);
            return true;
        }
        return false;
    }
    // Convenience methods for common state values
    async getLastHealthCheck() {
        return this.get("lastHealthCheck");
    }
    async setLastHealthCheck(timestamp) {
        await this.set("lastHealthCheck", timestamp);
    }
    async getLastDeepAnalysis() {
        return this.get("lastDeepAnalysis");
    }
    async setLastDeepAnalysis(timestamp) {
        await this.set("lastDeepAnalysis", timestamp);
    }
    async isMigrationCompleted() {
        const value = await this.get("migration_completed");
        return value === "true";
    }
    async setMigrationCompleted() {
        await this.set("migration_completed", "true");
    }
    async getCurrentChatSessionId() {
        return this.get("currentChatSessionId");
    }
    async setCurrentChatSessionId(sessionId) {
        await this.set("currentChatSessionId", sessionId);
    }
    // Stats helper
    async getStats(deps) {
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
//# sourceMappingURL=state.repository.js.map