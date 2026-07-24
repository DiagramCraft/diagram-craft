import type {
  NotificationPreferenceDatabase,
  NotificationPreferenceOverride
} from './notificationPreferenceDatabase';
import { notificationPreferenceMappers } from './notificationPreferenceDatabase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresNotificationPreferenceDatabase
  extends PostgresDatabaseBase
  implements NotificationPreferenceDatabase
{
  async listOverrides(userId: string, workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM user_notification_preference
      WHERE user_id = ${userId} AND workspace = ${workspace}
    `;
    return mapDatabaseRows(rows, notificationPreferenceMappers.preference);
  }

  async setOverrides(userId: string, workspace: string, entries: NotificationPreferenceOverride[]) {
    if (entries.length === 0) return;
    try {
      for (const entry of entries) {
        await this.sql`
          INSERT INTO user_notification_preference (
            user_id, workspace, notification_type, channel, enabled, updated_at
          ) VALUES (
            ${userId}, ${workspace}, ${entry.notificationType}, ${entry.channel},
            ${entry.enabled}, NOW()
          )
          ON CONFLICT (user_id, workspace, notification_type, channel) DO UPDATE
          SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at
        `;
      }
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
