import { randomUUID } from 'node:crypto';
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
    try {
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
        const notificationId = randomUUID();
        const deliveryKey = `${isRelation ? 'relation' : 'entity'}-watch:${auditLog.id}:user:${recipient.userId}`;
        const title = isRelation
          ? (relationContext?.schema?.name ?? auditLog.entity_name)
          : auditLog.entity_name;
        const message = isRelation
          ? `${changedByDisplayName} ${auditLog.operation}d this relation`
          : `${changedByDisplayName} ${auditLog.operation}d this entity`;
        const presentationMetadata = isRelation
          ? { relation: relationContext, schemaId: auditLog.schema_id }
          : {
              entitySlug: auditLog.entity_slug ?? auditLog.entity_id,
              schemaId: auditLog.schema_id
            };
        await this.sql`
          INSERT INTO user_inbox_notification (
            id, user_id, workspace, category, event_type, resource_type, resource_id,
            case_id, assignment_id, actor_user_id, actor_display_name, title, message,
            action_route, presentation_metadata, occurred_at, created_at, read_at, delivery_key,
            in_app_enabled
          )
          VALUES (
            ${notificationId}, ${recipient.userId}, ${auditLog.workspace}, 'information',
            ${`${auditLog.entity_type}.${auditLog.operation}`}, ${isRelation ? 'relation' : 'entity'}, ${auditLog.entity_id}, NULL, NULL,
            ${auditLog.user_id}, ${changedByDisplayName}, ${title},
            ${message}, NULL,
            ${this.json(presentationMetadata)}, ${auditLog.timestamp},
            NOW(), NULL, ${deliveryKey}, ${recipient.inAppEnabled}
          )
          ON CONFLICT (user_id, delivery_key) DO NOTHING
        `;
        if (recipient.emailEnabled && recipient.email) {
          const [notification] = await this.sql<{ id: string }[]>`
            SELECT id FROM user_inbox_notification
            WHERE user_id = ${recipient.userId} AND delivery_key = ${deliveryKey}
          `;
          if (notification) {
            await this.sql`
              INSERT INTO notification_delivery (
                id, notification_id, user_id, workspace, channel, status, recipient_email,
                max_attempts, next_attempt_at, created_at, updated_at
              ) VALUES (
                ${randomUUID()}, ${notification.id}, ${recipient.userId}, ${auditLog.workspace},
                'email', 'pending', ${recipient.email}, 5, NOW(), NOW(), NOW()
              ) ON CONFLICT (notification_id, channel) DO NOTHING
            `;
          }
        }
      }
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
