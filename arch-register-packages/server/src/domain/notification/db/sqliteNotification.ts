import type { InboxNotificationDbCreate, NotificationDatabase } from './notificationDatabase';
import { notificationMappers } from './notificationDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteNotificationDatabase extends SqliteDatabaseBase implements NotificationDatabase {
  async listNotifications(userId: string, workspace: string) {
    return this.all(
      `SELECT * FROM user_inbox_notification
       WHERE user_id = ? AND workspace = ?
         AND in_app_enabled = 1
       ORDER BY occurred_at DESC, created_at DESC`,
      [userId, workspace],
      notificationMappers.notification
    );
  }

  async getNotification(id: string) {
    return await this.get(
      'SELECT * FROM user_inbox_notification WHERE id = ?',
      [id],
      notificationMappers.notification
    );
  }

  async countUnread(userId: string, workspace: string) {
    const row = this.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM user_inbox_notification
       WHERE user_id = ? AND workspace = ? AND in_app_enabled = 1 AND read_at IS NULL`,
      [userId, workspace]
    );
    return Number(row?.count ?? 0);
  }

  async markRead(userId: string, workspace: string, id: string, readAt: Date) {
    const result = this.run(
      `UPDATE user_inbox_notification
       SET read_at = COALESCE(read_at, ?)
       WHERE id = ? AND user_id = ? AND workspace = ?`,
      [readAt.toISOString(), id, userId, workspace]
    );
    return result.changes > 0;
  }

  async markAllRead(userId: string, workspace: string, readAt: Date) {
    const result = this.run(
      `UPDATE user_inbox_notification SET read_at = ?
       WHERE user_id = ? AND workspace = ? AND read_at IS NULL`,
      [readAt.toISOString(), userId, workspace]
    );
    return result.changes;
  }

  async markReadByAssignmentIds(assignmentIds: string[], readAt: Date) {
    if (assignmentIds.length === 0) return 0;
    const placeholders = assignmentIds.map(() => '?').join(', ');
    const result = this.run(
      `UPDATE user_inbox_notification SET read_at = ?
       WHERE assignment_id IN (${placeholders}) AND read_at IS NULL`,
      [readAt.toISOString(), ...assignmentIds]
    );
    return result.changes;
  }

  async markReadByCaseIds(caseIds: string[], readAt: Date) {
    if (caseIds.length === 0) return 0;
    const placeholders = caseIds.map(() => '?').join(', ');
    const result = this.run(
      `UPDATE user_inbox_notification SET read_at = ?
       WHERE case_id IN (${placeholders}) AND read_at IS NULL`,
      [readAt.toISOString(), ...caseIds]
    );
    return result.changes;
  }

  async createNotification(input: InboxNotificationDbCreate) {
    this.run(
      `INSERT OR IGNORE INTO user_inbox_notification (
        id, user_id, workspace, category, event_type, resource_type, resource_id,
        case_id, assignment_id, actor_user_id, actor_display_name, title, message,
        action_route, presentation_metadata, occurred_at, created_at, read_at, delivery_key,
        in_app_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.user_id,
        input.workspace,
        input.category,
        input.event_type,
        input.resource_type,
        input.resource_id,
        input.case_id,
        input.assignment_id,
        input.actor_user_id,
        input.actor_display_name,
        input.title,
        input.message,
        input.action_route,
        JSON.stringify(input.presentation_metadata),
        input.occurred_at.toISOString(),
        (input.created_at ?? new Date()).toISOString(),
        input.read_at?.toISOString() ?? null,
        input.delivery_key,
        (input.in_app_enabled ?? true) ? 1 : 0
      ]
    );
    return (await this.get(
      'SELECT * FROM user_inbox_notification WHERE user_id = ? AND delivery_key = ?',
      [input.user_id, input.delivery_key],
      notificationMappers.notification
    ))!;
  }
}
