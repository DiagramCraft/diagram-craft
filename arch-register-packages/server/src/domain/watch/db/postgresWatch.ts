import type {
  WatchDbCreate,
  WatchDatabase,
  CreateNotificationsFromAuditInput
} from './watchDatabase';
import { watchMappers } from './watchDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';

export class PostgresWatchDatabase extends PostgresDatabaseBase implements WatchDatabase {
  async listWatcherUserIds(workspace: string, entityId: string) {
    const rows = await this.sql<{ user_id: string }[]>`
      SELECT user_id FROM user_watch
      WHERE workspace = ${workspace} AND entity_id = ${entityId}
      ORDER BY user_id
    `;
    return rows.map(row => row.user_id);
  }

  async listWatches(userId: string, workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM user_watch
      WHERE user_id = ${userId} AND workspace = ${workspace}
      ORDER BY created_at DESC
    `;
    return mapDatabaseRows(rows, watchMappers.watch);
  }

  async getWatch(userId: string, workspace: string, entityId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM user_watch
      WHERE user_id = ${userId} AND workspace = ${workspace} AND entity_id = ${entityId}
    `;
    return row ? watchMappers.watch(row) : null;
  }

  async createWatch(input: WatchDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO user_watch (user_id, workspace, entity_id, created_at)
        VALUES (${input.user_id}, ${input.workspace}, ${input.entity_id}, ${input.created_at})
        ON CONFLICT (user_id, workspace, entity_id) DO UPDATE
        SET created_at = user_watch.created_at
        RETURNING *
      `;
      return watchMappers.watch(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteWatch(userId: string, workspace: string, entityId: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM user_watch
        WHERE user_id = ${userId} AND workspace = ${workspace} AND entity_id = ${entityId}
        RETURNING *
      `;
      return row ? watchMappers.watch(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listNotifications(userId: string, workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM user_notification
      WHERE user_id = ${userId} AND workspace = ${workspace}
      ORDER BY timestamp DESC, created_at DESC
    `;
    return mapDatabaseRows(rows, watchMappers.notification);
  }

  async deleteNotification(userId: string, workspace: string, notificationId: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM user_notification
        WHERE id = ${notificationId} AND user_id = ${userId} AND workspace = ${workspace}
        RETURNING *
      `;
      return row ? watchMappers.notification(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async clearNotifications(userId: string, workspace: string) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        DELETE FROM user_notification
        WHERE user_id = ${userId} AND workspace = ${workspace}
        RETURNING id
      `;
      return rows.length;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async createNotificationsFromAudit(input: CreateNotificationsFromAuditInput) {
    const { auditLog, changedByDisplayName } = input;
    try {
      const watcherUserIds =
        input.watcherUserIds ??
        (await this.listWatcherUserIds(auditLog.workspace, auditLog.entity_id));

      for (const userId of watcherUserIds) {
        if (userId === auditLog.user_id) continue;
        await this.sql`
          INSERT INTO user_notification (
            user_id,
            workspace,
            entity_id,
            audit_log_id,
            operation,
            entity_name,
            entity_slug,
            schema_id,
            changed_by_user_id,
            changed_by_display_name,
            timestamp,
            created_at
          )
          VALUES (
            ${userId},
            ${auditLog.workspace},
            ${auditLog.entity_id},
            ${auditLog.id},
            ${auditLog.operation},
            ${auditLog.entity_name},
            ${auditLog.entity_slug ?? auditLog.entity_id},
            ${auditLog.schema_id},
            ${auditLog.user_id},
            ${changedByDisplayName},
            ${auditLog.timestamp},
            NOW()
          )
          ON CONFLICT (user_id, audit_log_id) DO NOTHING
        `;
      }
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
