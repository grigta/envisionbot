/**
 * Notification Service
 * Handles notification logic including quiet hours validation
 */

import type { NotificationPreferences, QuietHoursCheck, NotificationPriority } from "../types.js";

export class NotificationService {
  /**
   * Check if current time is within quiet hours
   */
  static checkQuietHours(prefs: NotificationPreferences): QuietHoursCheck {
    if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
      return { isQuietTime: false };
    }

    try {
      const timezone = prefs.quietHoursTimezone || "UTC";
      const now = new Date();

      // Get current time in user's timezone
      const currentTime = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);

      const [currentHour, currentMinute] = currentTime.split(":").map(Number);
      const [startHour, startMinute] = prefs.quietHoursStart.split(":").map(Number);
      const [endHour, endMinute] = prefs.quietHoursEnd.split(":").map(Number);

      const currentMinutes = currentHour * 60 + currentMinute;
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      let isQuiet = false;

      if (startMinutes < endMinutes) {
        // Normal range (e.g., 09:00 - 17:00)
        isQuiet = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Overnight range (e.g., 22:00 - 08:00)
        isQuiet = currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      if (isQuiet) {
        return {
          isQuietTime: true,
          reason: `Quiet hours active: ${prefs.quietHoursStart} - ${prefs.quietHoursEnd} (${timezone})`,
        };
      }

      return { isQuietTime: false };
    } catch (error) {
      console.error("Error checking quiet hours:", error);
      return { isQuietTime: false };
    }
  }

  /**
   * Check if notification should be sent based on priority filter
   */
  static shouldNotifyByPriority(
    notificationPriority: NotificationPriority,
    minimumPriority: NotificationPriority
  ): boolean {
    const priorityLevels: Record<NotificationPriority, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };

    return priorityLevels[notificationPriority] >= priorityLevels[minimumPriority];
  }

  /**
   * Determine if notification should be sent
   */
  static shouldSendNotification(
    prefs: NotificationPreferences,
    priority: NotificationPriority
  ): { shouldSend: boolean; reason?: string } {
    // Check quiet hours
    const quietCheck = this.checkQuietHours(prefs);
    if (quietCheck.isQuietTime) {
      return { shouldSend: false, reason: quietCheck.reason };
    }

    // Check priority filter
    if (!this.shouldNotifyByPriority(priority, prefs.minimumPriority)) {
      return {
        shouldSend: false,
        reason: `Priority ${priority} is below minimum ${prefs.minimumPriority}`,
      };
    }

    return { shouldSend: true };
  }
}
