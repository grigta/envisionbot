/**
 * Notification Service
 * Handles sending notifications via email and Telegram with quiet hours support
 */

import type { NotificationPreferences, Priority, NotificationType, QuietHoursCheck } from "../types.js";
import { NotificationPreferencesRepository } from "../repositories/notification-preferences.repository.js";
import type Database from "better-sqlite3";

export interface NotificationOptions {
  type: NotificationType;
  priority: Priority;
  title: string;
  message: string;
  userId?: string; // If specified, send to this user; otherwise use global settings
}

export class NotificationService {
  private preferencesRepo: NotificationPreferencesRepository;

  constructor(db: Database.Database) {
    this.preferencesRepo = new NotificationPreferencesRepository(db);
  }

  /**
   * Check if current time is within quiet hours
   */
  isQuietTime(preferences: NotificationPreferences): QuietHoursCheck {
    if (!preferences.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return { isQuietTime: false };
    }

    try {
      const now = new Date();
      const timezone = preferences.quietHoursTimezone || "UTC";

      // Get current time in user's timezone
      const currentTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      const hours = currentTime.getHours();
      const minutes = currentTime.getMinutes();
      const currentMinutes = hours * 60 + minutes;

      // Parse quiet hours
      const [startHour, startMin] = preferences.quietHoursStart.split(":").map(Number);
      const [endHour, endMin] = preferences.quietHoursEnd.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      let isQuiet = false;

      if (startMinutes < endMinutes) {
        // Same day (e.g., 09:00 - 17:00)
        isQuiet = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Crosses midnight (e.g., 22:00 - 08:00)
        isQuiet = currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      if (isQuiet) {
        // Calculate next allowed time
        const endDate = new Date(currentTime);
        endDate.setHours(endHour, endMin, 0, 0);

        // If end time is earlier than current time (crossed midnight), add a day
        if (endMinutes <= currentMinutes && startMinutes > endMinutes) {
          endDate.setDate(endDate.getDate() + 1);
        }

        return {
          isQuietTime: true,
          reason: `Quiet hours active (${preferences.quietHoursStart} - ${preferences.quietHoursEnd} ${timezone})`,
          nextAllowedTime: endDate.toISOString(),
        };
      }

      return { isQuietTime: false };
    } catch (error) {
      console.error("Error checking quiet hours:", error);
      return { isQuietTime: false }; // Default to allowing notifications on error
    }
  }

  /**
   * Check if notification should be sent based on preferences
   */
  shouldSendNotification(
    preferences: NotificationPreferences,
    options: NotificationOptions
  ): { allowed: boolean; reason?: string } {
    // Check quiet hours
    const quietCheck = this.isQuietTime(preferences);
    if (quietCheck.isQuietTime) {
      return { allowed: false, reason: quietCheck.reason };
    }

    // Check notification type filter
    if (!preferences.notificationTypes.includes("all") &&
        !preferences.notificationTypes.includes(options.type)) {
      return { allowed: false, reason: `Notification type '${options.type}' is disabled` };
    }

    // Check priority filter
    const priorityLevels: Record<Priority, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };

    if (priorityLevels[options.priority] < priorityLevels[preferences.minPriority]) {
      return {
        allowed: false,
        reason: `Priority '${options.priority}' is below minimum '${preferences.minPriority}'`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get notification preferences for a user or global
   */
  getPreferences(userId?: string): NotificationPreferences | null {
    if (userId) {
      return this.preferencesRepo.get(userId);
    }
    return this.preferencesRepo.getGlobal();
  }

  /**
   * Update notification preferences
   */
  updatePreferences(preferences: Partial<NotificationPreferences> & { userId?: string }): NotificationPreferences {
    return this.preferencesRepo.upsert(preferences);
  }

  /**
   * Initialize default global preferences (called on first run)
   */
  initializeDefaultPreferences(): NotificationPreferences {
    const existing = this.preferencesRepo.getGlobal();
    if (existing) {
      return existing;
    }

    // Get Telegram chat ID from environment
    const telegramChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    return this.preferencesRepo.upsert({
      userId: undefined, // Global preferences
      emailEnabled: false, // Email disabled by default (needs configuration)
      emailAddress: undefined,
      telegramEnabled: !!telegramChatId, // Enable if chat ID is set
      telegramChatId: telegramChatId,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      quietHoursTimezone: process.env.TIMEZONE || "UTC",
      notificationTypes: ["all"],
      minPriority: "low",
    });
  }
}
