/**
 * Pending Action Repository
 */

import type { PendingAction, SuggestedAction } from "../types.js";
import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

interface ActionRow {
  id: string;
  task_id: string;
  action_type: SuggestedAction["type"];
  action_description: string;
  action_payload: string;
  created_at: number;
  expires_at: number;
  status: PendingAction["status"];
  telegram_message_id: number | null;
}

export class ActionRepository extends BaseRepository<PendingAction> {
  protected readonly tableName = "pending_actions";
  protected readonly cachePrefix = "pm:action";
  protected readonly cacheTTL = 60; // 1 minute
  protected readonly pubsubChannel = "pm:events:actions" as const;

  private rowToAction(row: ActionRow): PendingAction {
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

  async getAll(): Promise<PendingAction[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM pending_actions ORDER BY created_at DESC"
    );
    const rows = stmt.all() as ActionRow[];
    return rows.map((row) => this.rowToAction(row));
  }

  async getPending(): Promise<PendingAction[]> {
    const cacheKey = "pm:actions:pending";
    const cached = await this.getFromCache<PendingAction[]>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare(
      "SELECT * FROM pending_actions WHERE status = 'pending' ORDER BY created_at DESC"
    );
    const rows = stmt.all() as ActionRow[];
    const actions = rows.map((row) => this.rowToAction(row));

    await this.setCache(cacheKey, actions, 30);
    return actions;
  }

  async getById(id: string): Promise<PendingAction | undefined> {
    const cacheKey = this.entityCacheKey(id);
    const cached = await this.getFromCache<PendingAction>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM pending_actions WHERE id = ?");
    const row = stmt.get(id) as ActionRow | undefined;

    if (row) {
      const action = this.rowToAction(row);
      await this.setCache(cacheKey, action);
      return action;
    }

    return undefined;
  }

  async getByTaskId(taskId: string): Promise<PendingAction[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM pending_actions WHERE task_id = ? ORDER BY created_at DESC"
    );
    const rows = stmt.all(taskId) as ActionRow[];
    return rows.map((row) => this.rowToAction(row));
  }

  async create(action: PendingAction): Promise<PendingAction> {
    const stmt = this.db.prepare(`
      INSERT INTO pending_actions (
        id, task_id, action_type, action_description, action_payload,
        created_at, expires_at, status, telegram_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      action.id,
      action.taskId,
      action.action.type,
      action.action.description,
      JSON.stringify(action.action.payload),
      action.createdAt,
      action.expiresAt,
      action.status,
      action.telegramMessageId ?? null
    );

    await this.invalidateCache("pm:actions:pending", "pm:stats");
    await this.publishEvent("action_pending", action);

    return action;
  }

  async updateStatus(
    id: string,
    status: PendingAction["status"],
    telegramMessageId?: number
  ): Promise<PendingAction | undefined> {
    const action = await this.getById(id);
    if (!action) return undefined;

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

    await this.invalidateCache(
      this.entityCacheKey(id),
      "pm:actions:pending",
      "pm:stats"
    );

    const eventType = status === "approved" ? "action_approved" : "action_rejected";
    await this.publishEvent(eventType, updatedAction);

    return updatedAction;
  }

  async expireOld(): Promise<number> {
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
