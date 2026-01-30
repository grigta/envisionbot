/**
 * Pending Action Repository
 */
import { BaseRepository } from "./base.repository.js";
export class ActionRepository extends BaseRepository {
    tableName = "pending_actions";
    cachePrefix = "pm:action";
    cacheTTL = 60; // 1 minute
    pubsubChannel = "pm:events:actions";
    rowToAction(row) {
        return {
            id: row.id,
            taskId: row.task_id,
            action: {
                type: row.action_type,
                description: row.action_description,
                payload: JSON.parse(row.action_payload),
            },
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            status: row.status,
            telegramMessageId: row.telegram_message_id ?? undefined,
        };
    }
    async getAll() {
        const stmt = this.db.prepare("SELECT * FROM pending_actions ORDER BY created_at DESC");
        const rows = stmt.all();
        return rows.map((row) => this.rowToAction(row));
    }
    async getPending() {
        const cacheKey = "pm:actions:pending";
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM pending_actions WHERE status = 'pending' ORDER BY created_at DESC");
        const rows = stmt.all();
        const actions = rows.map((row) => this.rowToAction(row));
        await this.setCache(cacheKey, actions, 30);
        return actions;
    }
    async getById(id) {
        const cacheKey = this.entityCacheKey(id);
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM pending_actions WHERE id = ?");
        const row = stmt.get(id);
        if (row) {
            const action = this.rowToAction(row);
            await this.setCache(cacheKey, action);
            return action;
        }
        return undefined;
    }
    async getByTaskId(taskId) {
        const stmt = this.db.prepare("SELECT * FROM pending_actions WHERE task_id = ? ORDER BY created_at DESC");
        const rows = stmt.all(taskId);
        return rows.map((row) => this.rowToAction(row));
    }
    async create(action) {
        const stmt = this.db.prepare(`
      INSERT INTO pending_actions (
        id, task_id, action_type, action_description, action_payload,
        created_at, expires_at, status, telegram_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(action.id, action.taskId, action.action.type, action.action.description, JSON.stringify(action.action.payload), action.createdAt, action.expiresAt, action.status, action.telegramMessageId ?? null);
        await this.invalidateCache("pm:actions:pending", "pm:stats");
        await this.publishEvent("action_pending", action);
        return action;
    }
    async updateStatus(id, status, telegramMessageId) {
        const action = await this.getById(id);
        if (!action)
            return undefined;
        const stmt = this.db.prepare(`
      UPDATE pending_actions
      SET status = ?, telegram_message_id = COALESCE(?, telegram_message_id)
      WHERE id = ?
    `);
        stmt.run(status, telegramMessageId ?? null, id);
        const updatedAction = {
            ...action,
            status,
            telegramMessageId: telegramMessageId ?? action.telegramMessageId,
        };
        await this.invalidateCache(this.entityCacheKey(id), "pm:actions:pending", "pm:stats");
        const eventType = status === "approved" ? "action_approved" : "action_rejected";
        await this.publishEvent(eventType, updatedAction);
        return updatedAction;
    }
    async expireOld() {
        const now = Date.now();
        const stmt = this.db.prepare(`
      UPDATE pending_actions
      SET status = 'expired'
      WHERE status = 'pending' AND expires_at < ?
    `);
        const result = stmt.run(now);
        if (result.changes > 0) {
            await this.invalidateCache("pm:actions:pending", "pm:stats");
        }
        return result.changes;
    }
}
//# sourceMappingURL=action.repository.js.map