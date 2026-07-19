import type { InboxNotificationDbCreate, NotificationDatabase } from './notificationDatabase';
import { notificationMappers } from './notificationDatabase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresNotificationDatabase
  extends PostgresDatabaseBase
  implements NotificationDatabase
{
  async listNotifications(userId: string, workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM user_inbox_notification
      WHERE user_id = ${userId} AND workspace = ${workspace} AND in_app_enabled = TRUE
      ORDER BY occurred_at DESC, created_at DESC
    `;
    return mapDatabaseRows(rows, notificationMappers.notification);
  }

  async getNotification(id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM user_inbox_notification WHERE id = ${id}
    `;
    return row ? notificationMappers.notification(row) : null;
  }

  async countUnread(userId: string, workspace: string) {
    const [row] = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM user_inbox_notification
      WHERE user_id = ${userId} AND workspace = ${workspace}
        AND in_app_enabled = TRUE AND read_at IS NULL
    `;
    return Number(row?.count ?? 0);
  }

  async markRead(userId: string, workspace: string, id: string, readAt: Date) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE user_inbox_notification
        SET read_at = COALESCE(read_at, ${readAt})
        WHERE id = ${id} AND user_id = ${userId} AND workspace = ${workspace}
        RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async markAllRead(userId: string, workspace: string, readAt: Date) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE user_inbox_notification SET read_at = ${readAt}
        WHERE user_id = ${userId} AND workspace = ${workspace} AND read_at IS NULL
        RETURNING id
      `;
      return rows.length;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async markReadByAssignmentIds(assignmentIds: string[], readAt: Date) {
    if (assignmentIds.length === 0) return 0;
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE user_inbox_notification SET read_at = ${readAt}
        WHERE assignment_id = ANY(${assignmentIds}) AND read_at IS NULL
        RETURNING id
      `;
      return rows.length;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async markReadByCaseIds(caseIds: string[], readAt: Date) {
    if (caseIds.length === 0) return 0;
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE user_inbox_notification SET read_at = ${readAt}
        WHERE case_id = ANY(${caseIds}) AND read_at IS NULL
        RETURNING id
      `;
      return rows.length;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async createNotification(input: InboxNotificationDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO user_inbox_notification (
          id, user_id, workspace, category, event_type, resource_type, resource_id,
          case_id, assignment_id, actor_user_id, actor_display_name, title, message,
          action_route, presentation_metadata, occurred_at, created_at, read_at, delivery_key,
          in_app_enabled
        ) VALUES (
          ${input.id}, ${input.user_id}, ${input.workspace}, ${input.category}, ${input.event_type},
          ${input.resource_type}, ${input.resource_id}, ${input.case_id}, ${input.assignment_id},
          ${input.actor_user_id}, ${input.actor_display_name}, ${input.title}, ${input.message},
          ${input.action_route}, ${this.json(input.presentation_metadata)}, ${input.occurred_at},
          ${input.created_at ?? new Date()}, ${input.read_at ?? null}, ${input.delivery_key},
          ${input.in_app_enabled ?? true}
        )
        ON CONFLICT (user_id, delivery_key) DO NOTHING
        RETURNING *
      `;
      if (row) return notificationMappers.notification(row);
      const [existing] = await this.sql<DatabaseRow[]>`
        SELECT * FROM user_inbox_notification
        WHERE user_id = ${input.user_id} AND delivery_key = ${input.delivery_key}
      `;
      return notificationMappers.notification(existing!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
