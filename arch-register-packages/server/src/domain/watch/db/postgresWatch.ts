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
    try {
      const watcherUserIds =
        input.watcherUserIds ??
        (await this.listWatcherUserIds(auditLog.workspace, auditLog.entity_id));

      for (const userId of watcherUserIds) {
        if (userId === auditLog.user_id) continue;
        const entitySlug = auditLog.entity_slug ?? auditLog.entity_id;
        await this.sql`
          INSERT INTO user_inbox_notification (
            id, user_id, workspace, category, event_type, resource_type, resource_id,
            case_id, assignment_id, actor_user_id, actor_display_name, title, message,
            action_route, presentation_metadata, occurred_at, created_at, read_at, delivery_key
          )
          VALUES (
            ${randomUUID()}, ${userId}, ${auditLog.workspace}, 'information',
            ${`entity.${auditLog.operation}`}, 'entity', ${auditLog.entity_id}, NULL, NULL,
            ${auditLog.user_id}, ${changedByDisplayName}, ${auditLog.entity_name},
            ${`${changedByDisplayName} ${auditLog.operation}d this entity`}, NULL,
            ${this.json({ entitySlug, schemaId: auditLog.schema_id })}, ${auditLog.timestamp},
            NOW(), NULL, ${`entity-watch:${auditLog.id}:user:${userId}`}
          )
          ON CONFLICT (user_id, delivery_key) DO NOTHING
        `;
      }
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
