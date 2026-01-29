/**
 * Notification Preferences Repository
 * CRUD operations for user notification preferences
 */

import { BaseRepository } from "./base.repository.js";
import type { RepositoryDeps } from "../db/index.js";
import type { NotificationPreferences, NotificationType, NotificationPriority } from "../types.js";

export class NotificationPreferencesRepository extends BaseRepository<NotificationPreferences> {
  protected readonly tableName = "notification_preferences";
  protected readonly cachePrefix = "notification_prefs";
  protected readonly cacheTTL = 300; // 5 minutes
  protected readonly pubsubChannel = "pm:events:projects" as const;

  constructor(deps: RepositoryDeps) {
    super(deps);
  }

  /**
   * Get notification preferences for a specific access code
   * Falls back to default preferences if not found
   */
  async getByAccessCode(accessCodeId?: string): Promise<NotificationPreferences> {
    const cacheKey = `${this.cachePrefix}:${accessCodeId || "default"}`;
    const cached = await this.getFromCache<NotificationPreferences>(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE access_code_id ${accessCodeId ? "= ?" : "IS NULL"}
      LIMIT 1
    `;

    const row = accessCodeId
      ? this.db.prepare(query).get(accessCodeId)
      : this.db.prepare(query).get();

    if (row) {
      const prefs = this.mapRowToPreferences(row);
      await this.setCache(cacheKey, prefs);
      return prefs;
    }

    // If no preferences found, return default
    return this.getDefault();
  }

  /**
   * Get default notification preferences
   */
  async getDefault(): Promise<NotificationPreferences> {
    const cacheKey = `${this.cachePrefix}:default`;
    const cached = await this.getFromCache<NotificationPreferences>(cacheKey);
    if (cached) return cached;

    const row = this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = 'default'`)
      .get();

    if (!row) {
      // Fallback if default doesn't exist
      return {
        id: "default",
        emailEnabled: false,
        telegramEnabled: true,
        quietHoursEnabled: false,
        enabledNotificationTypes: [],
        minimumPriority: "low",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const prefs = this.mapRowToPreferences(row);
    await this.setCache(cacheKey, prefs);
    return prefs;
  }

  /**
   * Update notification preferences
   */
  async update(
    accessCodeId: string | undefined,
    updates: Partial<Omit<NotificationPreferences, "id" | "createdAt" | "updatedAt">>
  ): Promise<NotificationPreferences> {
    const now = Date.now();

    // Check if preferences exist
    const existing = await this.getByAccessCode(accessCodeId);

    if (existing.id === "default" && accessCodeId) {
      // Create new preferences for this access code
      const id = `prefs_${accessCodeId}_${Date.now()}`;
      const prefs: NotificationPreferences = {
        id,
        accessCodeId,
        emailEnabled: updates.emailEnabled ?? false,
        emailAddress: updates.emailAddress,
        telegramEnabled: updates.telegramEnabled ?? true,
        telegramChatId: updates.telegramChatId,
        quietHoursEnabled: updates.quietHoursEnabled ?? false,
        quietHoursStart: updates.quietHoursStart,
        quietHoursEnd: updates.quietHoursEnd,
        quietHoursTimezone: updates.quietHoursTimezone ?? "UTC",
        enabledNotificationTypes: updates.enabledNotificationTypes ?? [],
        minimumPriority: updates.minimumPriority ?? "low",
        createdAt: now,
        updatedAt: now,
      };

      this.db
        .prepare(
          `INSERT INTO ${this.tableName} (
          id, access_code_id, email_enabled, email_address,
          telegram_enabled, telegram_chat_id,
          quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone,
          enabled_notification_types, minimum_priority,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          prefs.id,
          prefs.accessCodeId || null,
          prefs.emailEnabled ? 1 : 0,
          prefs.emailAddress || null,
          prefs.telegramEnabled ? 1 : 0,
          prefs.telegramChatId || null,
          prefs.quietHoursEnabled ? 1 : 0,
          prefs.quietHoursStart || null,
          prefs.quietHoursEnd || null,
          prefs.quietHoursTimezone,
          JSON.stringify(prefs.enabledNotificationTypes),
          prefs.minimumPriority,
          prefs.createdAt,
          prefs.updatedAt
        );

      await this.invalidateCache(`${this.cachePrefix}:${accessCodeId || "default"}`);
      return prefs;
    } else {
      // Update existing preferences
      const prefs: NotificationPreferences = {
        ...existing,
        emailEnabled: updates.emailEnabled ?? existing.emailEnabled,
        emailAddress: updates.emailAddress ?? existing.emailAddress,
        telegramEnabled: updates.telegramEnabled ?? existing.telegramEnabled,
        telegramChatId: updates.telegramChatId ?? existing.telegramChatId,
        quietHoursEnabled: updates.quietHoursEnabled ?? existing.quietHoursEnabled,
        quietHoursStart: updates.quietHoursStart ?? existing.quietHoursStart,
        quietHoursEnd: updates.quietHoursEnd ?? existing.quietHoursEnd,
        quietHoursTimezone: updates.quietHoursTimezone ?? existing.quietHoursTimezone,
        enabledNotificationTypes: updates.enabledNotificationTypes ?? existing.enabledNotificationTypes,
        minimumPriority: updates.minimumPriority ?? existing.minimumPriority,
        updatedAt: now,
      };

      this.db
        .prepare(
          `UPDATE ${this.tableName} SET
          email_enabled = ?, email_address = ?,
          telegram_enabled = ?, telegram_chat_id = ?,
          quiet_hours_enabled = ?, quiet_hours_start = ?, quiet_hours_end = ?, quiet_hours_timezone = ?,
          enabled_notification_types = ?, minimum_priority = ?,
          updated_at = ?
        WHERE id = ?`
        )
        .run(
          prefs.emailEnabled ? 1 : 0,
          prefs.emailAddress || null,
          prefs.telegramEnabled ? 1 : 0,
          prefs.telegramChatId || null,
          prefs.quietHoursEnabled ? 1 : 0,
          prefs.quietHoursStart || null,
          prefs.quietHoursEnd || null,
          prefs.quietHoursTimezone,
          JSON.stringify(prefs.enabledNotificationTypes),
          prefs.minimumPriority,
          prefs.updatedAt,
          prefs.id
        );

      await this.invalidateCache(`${this.cachePrefix}:${accessCodeId || "default"}`);
      return prefs;
    }
  }

  /**
   * Map database row to NotificationPreferences object
   */
  private mapRowToPreferences(row: any): NotificationPreferences {
    return {
      id: row.id,
      accessCodeId: row.access_code_id || undefined,
      emailEnabled: Boolean(row.email_enabled),
      emailAddress: row.email_address || undefined,
      telegramEnabled: Boolean(row.telegram_enabled),
      telegramChatId: row.telegram_chat_id || undefined,
      quietHoursEnabled: Boolean(row.quiet_hours_enabled),
      quietHoursStart: row.quiet_hours_start || undefined,
      quietHoursEnd: row.quiet_hours_end || undefined,
      quietHoursTimezone: row.quiet_hours_timezone || "UTC",
      enabledNotificationTypes: row.enabled_notification_types
        ? JSON.parse(row.enabled_notification_types)
        : [],
      minimumPriority: (row.minimum_priority || "low") as NotificationPriority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
