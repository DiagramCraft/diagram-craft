import type {
  CreateNotificationsFromAuditInput,
  WatchDbCreate,
  WatchDatabase,
  WatcherEntityRow
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

  async listWatcherUserIdsForEntities(workspace: string, entityIds: string[]) {
    if (entityIds.length === 0) return [];
    const placeholders = entityIds.map(() => '?').join(', ');
    return this.all<WatcherEntityRow>(
      `SELECT user_id, entity_id FROM user_watch
       WHERE workspace = ? AND entity_id IN (${placeholders})
       ORDER BY entity_id, user_id`,
      [workspace, ...entityIds]
    );
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
    const relation = auditLog.metadata['relation'];
    const relationContext =
      auditLog.entity_type === 'relation' && typeof relation === 'object' && relation != null
        ? (relation as { schema?: { name?: string }; in?: { id?: string }; out?: { id?: string } })
        : null;
    const isRelation = auditLog.entity_type === 'relation';
    const watchedEntityIds = [
      ...(input.watchedEntityIds ?? []),
      ...(!isRelation ? [auditLog.entity_id] : []),
      ...(relationContext?.in?.id ? [relationContext.in.id] : []),
      ...(relationContext?.out?.id ? [relationContext.out.id] : [])
    ].filter((id, index, ids) => ids.indexOf(id) === index);
    const watcherRecipients =
      input.watcherRecipients ??
      (
        input.watcherUserIds ?? [
          ...new Set(
            (
              await Promise.all(
                watchedEntityIds.map(entityId =>
                  this.listWatcherUserIds(auditLog.workspace, entityId)
                )
              )
            ).flat()
          )
        ]
      ).map(userId => ({
        userId,
        email: null,
        inAppEnabled: true,
        emailEnabled: false,
        relationVisible: false
      }));

    for (const recipient of watcherRecipients) {
      if (recipient.userId === auditLog.user_id) continue;
      if (!recipient.inAppEnabled && !recipient.emailEnabled) continue;
      if (isRelation && recipient.relationVisible !== true) continue;
      const notificationId = newid();
      const deliveryKey = `${isRelation ? 'relation' : 'entity'}-watch:${auditLog.id}:user:${recipient.userId}`;
      const title = isRelation
        ? (relationContext?.schema?.name ?? auditLog.entity_name)
        : auditLog.entity_name;
      const message = isRelation
        ? `${changedByDisplayName} ${auditLog.operation}d this relation`
        : `${changedByDisplayName} ${auditLog.operation}d this entity`;
      const presentationMetadata = isRelation
        ? { relation: relationContext, schemaId: auditLog.schema_id }
        : { entitySlug: auditLog.entity_slug ?? auditLog.entity_id, schemaId: auditLog.schema_id };
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
          `${auditLog.entity_type}.${auditLog.operation}`,
          isRelation ? 'relation' : 'entity',
          auditLog.entity_id,
          null,
          null,
          auditLog.user_id,
          changedByDisplayName,
          title,
          message,
          null,
          JSON.stringify(presentationMetadata),
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
