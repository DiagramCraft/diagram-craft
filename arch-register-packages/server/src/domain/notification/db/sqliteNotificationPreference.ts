import type {
  NotificationPreferenceDatabase,
  NotificationPreferenceOverride
} from './notificationPreferenceDatabase';
import { notificationPreferenceMappers } from './notificationPreferenceDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteNotificationPreferenceDatabase
  extends SqliteDatabaseBase
  implements NotificationPreferenceDatabase
{
  async listOverrides(userId: string, workspace: string) {
    return this.all(
      `SELECT * FROM user_notification_preference WHERE user_id = ? AND workspace = ?`,
      [userId, workspace],
      notificationPreferenceMappers.preference
    );
  }

  async setOverrides(userId: string, workspace: string, entries: NotificationPreferenceOverride[]) {
    const updatedAt = new Date().toISOString();
    for (const entry of entries) {
      this.run(
        `INSERT INTO user_notification_preference (
          user_id, workspace, notification_type, channel, enabled, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, workspace, notification_type, channel) DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = excluded.updated_at`,
        [userId, workspace, entry.notificationType, entry.channel, entry.enabled ? 1 : 0, updatedAt]
      );
    }
  }
}
