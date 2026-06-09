import type {
  CreateNotificationsFromAuditInput,
  CreateUserWatchInput,
  WatchDatabase
} from './watchDatabase';
import { SqliteDatabaseBase, sqliteMappers } from '../../../db/sqliteBase';
import { newid } from '@diagram-craft/utils/id';

export class SqliteWatchDatabase extends SqliteDatabaseBase implements WatchDatabase {
  async listWatcherUserIds(workspace: string, entityId: string) {
    const rows = this.all<{ user_id: string }>(
      'SELECT user_id FROM user_watch WHERE workspace = ? AND entity_id = ? ORDER BY user_id',
      [workspace, entityId]
    );
    return rows.map(row => row.user_id);
  }

  async listWatches(userId: string, workspace: string) {
    return this.all(
      'SELECT * FROM user_watch WHERE user_id = ? AND workspace = ? ORDER BY created_at DESC',
      [userId, workspace],
      sqliteMappers.userWatch
    );
  }

  async getWatch(userId: string, workspace: string, entityId: string) {
    return await this.get(
      'SELECT * FROM user_watch WHERE user_id = ? AND workspace = ? AND entity_id = ?',
      [userId, workspace, entityId],
      sqliteMappers.userWatch
    );
  }

  async createWatch(input: CreateUserWatchInput) {
    this.run(
      'INSERT OR IGNORE INTO user_watch (user_id, workspace, entity_id, created_at) VALUES (?, ?, ?, ?)',
      [input.user_id, input.workspace, input.entity_id, input.created_at.toISOString()]
    );
    return (
      await this.get(
        'SELECT * FROM user_watch WHERE user_id = ? AND workspace = ? AND entity_id = ?',
        [input.user_id, input.workspace, input.entity_id],
        sqliteMappers.userWatch
      )
    )!;
  }

  async deleteWatch(userId: string, workspace: string, entityId: string) {
    const existing = await this.getWatch(userId, workspace, entityId);
    if (!existing) return null;
    this.run('DELETE FROM user_watch WHERE user_id = ? AND workspace = ? AND entity_id = ?', [
      userId,
      workspace,
      entityId
    ]);
    return existing;
  }

  async listNotifications(userId: string, workspace: string) {
    return this.all(
      'SELECT * FROM user_notification WHERE user_id = ? AND workspace = ? ORDER BY timestamp DESC, created_at DESC',
      [userId, workspace],
      sqliteMappers.userNotification
    );
  }

  async deleteNotification(userId: string, workspace: string, notificationId: string) {
    const existing = await this.get(
      'SELECT * FROM user_notification WHERE id = ? AND user_id = ? AND workspace = ?',
      [notificationId, userId, workspace],
      sqliteMappers.userNotification
    );
    if (!existing) return null;
    this.run('DELETE FROM user_notification WHERE id = ? AND user_id = ? AND workspace = ?', [
      notificationId,
      userId,
      workspace
    ]);
    return existing;
  }

  async clearNotifications(userId: string, workspace: string) {
    const result = this.run('DELETE FROM user_notification WHERE user_id = ? AND workspace = ?', [
      userId,
      workspace
    ]);
    return result.changes;
  }

  async createNotificationsFromAudit(input: CreateNotificationsFromAuditInput) {
    const { auditLog, changedByDisplayName } = input;
    const watcherIds = (input.watcherUserIds ?? (await this.listWatcherUserIds(auditLog.workspace, auditLog.entity_id)))
      .filter(userId => userId !== auditLog.user_id)
      .map(user_id => ({ user_id }));

    for (const watcher of watcherIds) {
      this.run(
        `INSERT OR IGNORE INTO user_notification (
          id, user_id, workspace, entity_id, audit_log_id, operation, entity_name, entity_slug,
          schema_id, changed_by_user_id, changed_by_display_name, timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newid(),
          watcher.user_id,
          auditLog.workspace,
          auditLog.entity_id,
          auditLog.id,
          auditLog.operation,
          auditLog.entity_name,
          auditLog.entity_slug,
          auditLog.schema_id,
          auditLog.user_id,
          changedByDisplayName,
          auditLog.timestamp.toISOString(),
          new Date().toISOString()
        ]
      );
    }
  }
}
