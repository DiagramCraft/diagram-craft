import type {
  CreateNotificationsFromAuditInput,
  WatchDbCreate,
  WatchDatabase
} from './watchDatabase';
import { watchMappers } from './watchDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
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
      watchMappers.watch
    );
  }

  async getWatch(userId: string, workspace: string, entityId: string) {
    return await this.get(
      'SELECT * FROM user_watch WHERE user_id = ? AND workspace = ? AND entity_id = ?',
      [userId, workspace, entityId],
      watchMappers.watch
    );
  }

  async createWatch(input: WatchDbCreate) {
    this.run(
      'INSERT OR IGNORE INTO user_watch (user_id, workspace, entity_id, created_at) VALUES (?, ?, ?, ?)',
      [input.user_id, input.workspace, input.entity_id, input.created_at.toISOString()]
    );
    return (await this.get(
      'SELECT * FROM user_watch WHERE user_id = ? AND workspace = ? AND entity_id = ?',
      [input.user_id, input.workspace, input.entity_id],
      watchMappers.watch
    ))!;
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

  async createNotificationsFromAudit(input: CreateNotificationsFromAuditInput) {
    const { auditLog, changedByDisplayName } = input;
    const watcherRecipients =
      input.watcherRecipients ??
      (input.watcherUserIds ?? (await this.listWatcherUserIds(auditLog.workspace, auditLog.entity_id))).map(
        userId => ({ userId, email: null, inAppEnabled: true, emailEnabled: false })
      );

    for (const recipient of watcherRecipients) {
      if (recipient.userId === auditLog.user_id) continue;
      if (!recipient.inAppEnabled && !recipient.emailEnabled) continue;
      const entitySlug = auditLog.entity_slug ?? auditLog.entity_id;
      const notificationId = newid();
      const deliveryKey = `entity-watch:${auditLog.id}:user:${recipient.userId}`;
      this.run(
        `INSERT OR IGNORE INTO user_inbox_notification (
          id, user_id, workspace, category, event_type, resource_type, resource_id,
          case_id, assignment_id, actor_user_id, actor_display_name, title, message,
          action_route, presentation_metadata, occurred_at, created_at, read_at, delivery_key,
          in_app_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          notificationId,
          recipient.userId,
          auditLog.workspace,
          'information',
          `entity.${auditLog.operation}`,
          'entity',
          auditLog.entity_id,
          null,
          null,
          auditLog.user_id,
          changedByDisplayName,
          auditLog.entity_name,
          `${changedByDisplayName} ${auditLog.operation}d this entity`,
          null,
          JSON.stringify({ entitySlug, schemaId: auditLog.schema_id }),
          auditLog.timestamp.toISOString(),
          new Date().toISOString(),
          null,
          deliveryKey,
          recipient.inAppEnabled ? 1 : 0
        ]
      );
      if (recipient.emailEnabled && recipient.email) {
        const notification = this.get<{ id: string }>(
          'SELECT id FROM user_inbox_notification WHERE user_id = ? AND delivery_key = ?',
          [recipient.userId, deliveryKey]
        );
        if (notification) {
          this.run(
            `INSERT OR IGNORE INTO notification_delivery (
              id, notification_id, user_id, workspace, channel, status, recipient_email,
              max_attempts, next_attempt_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'email', 'pending', ?, 5, ?, ?, ?)`,
            [
              newid(),
              notification.id,
              recipient.userId,
              auditLog.workspace,
              recipient.email,
              new Date().toISOString(),
              new Date().toISOString(),
              new Date().toISOString()
            ]
          );
        }
      }
    }
  }
}
