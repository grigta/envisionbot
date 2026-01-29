/**
 * Notification Preferences Repository
 * Handles CRUD operations for user notification preferences
 */

import type Database from "better-sqlite3";
import type { NotificationPreferences, Priority, NotificationType } from "../types.js";

export class NotificationPreferencesRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Get notification preferences for a user (or global if userId is null)
   */
  get(userId?: string): NotificationPreferences | null {
    const stmt = this.db.prepare(
      `SELECT * FROM notification_preferences
       WHERE user_id IS ? OR (? IS NULL AND user_id IS NULL)
       LIMIT 1`
    );

    const row = stmt.get(userId ?? null, userId ?? null) as any;
    if (!row) return null;

    return this.rowToPreferences(row);
  }

  /**
   * Get global notification preferences (for backward compatibility)
   */
  getGlobal(): NotificationPreferences | null {
    const stmt = this.db.prepare(
      `SELECT * FROM notification_preferences WHERE user_id IS NULL LIMIT 1`
    );

    const row = stmt.get() as any;
    if (!row) return null;

    return this.rowToPreferences(row);
  }

  /**
   * Create or update notification preferences
   */
  upsert(preferences: Partial<NotificationPreferences> & { userId?: string }): NotificationPreferences {
    const existing = this.get(preferences.userId);
    const now = Date.now();

    if (existing) {
      // Update existing preferences
      const stmt = this.db.prepare(
        `UPDATE notification_preferences
         SET email_enabled = ?,
             email_address = ?,
             telegram_enabled = ?,
             telegram_chat_id = ?,
             quiet_hours_enabled = ?,
             quiet_hours_start = ?,
             quiet_hours_end = ?,
             quiet_hours_timezone = ?,
             notification_types = ?,
             min_priority = ?,
             updated_at = ?
         WHERE id = ?`
      );

      stmt.run(
        preferences.emailEnabled ?? existing.emailEnabled ? 1 : 0,
        preferences.emailAddress ?? existing.emailAddress ?? null,
        preferences.telegramEnabled ?? existing.telegramEnabled ? 1 : 0,
        preferences.telegramChatId ?? existing.telegramChatId ?? null,
        preferences.quietHoursEnabled ?? existing.quietHoursEnabled ? 1 : 0,
        preferences.quietHoursStart ?? existing.quietHoursStart ?? null,
        preferences.quietHoursEnd ?? existing.quietHoursEnd ?? null,
        preferences.quietHoursTimezone ?? existing.quietHoursTimezone,
        JSON.stringify(preferences.notificationTypes ?? existing.notificationTypes),
        preferences.minPriority ?? existing.minPriority,
        now,
        existing.id
      );

      return this.get(preferences.userId)!;
    } else {
      // Create new preferences
      const id = `notif-prefs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const stmt = this.db.prepare(
        `INSERT INTO notification_preferences (
           id, user_id, email_enabled, email_address,
           telegram_enabled, telegram_chat_id,
           quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone,
           notification_types, min_priority, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      stmt.run(
        id,
        preferences.userId ?? null,
        preferences.emailEnabled ? 1 : 0,
        preferences.emailAddress ?? null,
        preferences.telegramEnabled !== false ? 1 : 0,
        preferences.telegramChatId ?? null,
        preferences.quietHoursEnabled ? 1 : 0,
        preferences.quietHoursStart ?? null,
        preferences.quietHoursEnd ?? null,
        preferences.quietHoursTimezone ?? "UTC",
        JSON.stringify(preferences.notificationTypes ?? ["all"]),
        preferences.minPriority ?? "low",
        now,
        now
      );

      return this.get(preferences.userId)!;
    }
  }

  /**
   * Delete notification preferences
   */
  delete(userId?: string): void {
    const stmt = this.db.prepare(
      `DELETE FROM notification_preferences WHERE user_id IS ?`
    );
    stmt.run(userId ?? null);
  }

  /**
   * Get all users with email notifications enabled
   */
  getAllWithEmailEnabled(): NotificationPreferences[] {
    const stmt = this.db.prepare(
      `SELECT * FROM notification_preferences
       WHERE email_enabled = 1 AND email_address IS NOT NULL`
    );

    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToPreferences(row));
  }

  /**
   * Get all users with Telegram notifications enabled
   */
  getAllWithTelegramEnabled(): NotificationPreferences[] {
    const stmt = this.db.prepare(
      `SELECT * FROM notification_preferences
       WHERE telegram_enabled = 1 AND telegram_chat_id IS NOT NULL`
    );

    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToPreferences(row));
  }

  /**
   * Convert database row to NotificationPreferences object
   */
  private rowToPreferences(row: any): NotificationPreferences {
    return {
      id: row.id,
      userId: row.user_id ?? undefined,
      emailEnabled: row.email_enabled === 1,
      emailAddress: row.email_address ?? undefined,
      telegramEnabled: row.telegram_enabled === 1,
      telegramChatId: row.telegram_chat_id ?? undefined,
      quietHoursEnabled: row.quiet_hours_enabled === 1,
      quietHoursStart: row.quiet_hours_start ?? undefined,
      quietHoursEnd: row.quiet_hours_end ?? undefined,
      quietHoursTimezone: row.quiet_hours_timezone,
      notificationTypes: JSON.parse(row.notification_types) as NotificationType[],
      minPriority: row.min_priority as Priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
