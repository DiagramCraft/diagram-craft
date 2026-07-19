import { randomUUID } from 'node:crypto';
import type { PostgresSqlClient } from '../../../db/postgresBase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type { DatabaseRow } from '../../../db/rowMappers';
import type {
  NotificationDeliveryClaim,
  NotificationDeliveryDatabase,
  NotificationDeliveryDbCreate
} from './notificationDeliveryDatabase';
import { notificationDeliveryMappers } from './notificationDeliveryDatabase';

export class PostgresNotificationDeliveryDatabase
  extends PostgresDatabaseBase
  implements NotificationDeliveryDatabase
{
  async createDelivery(input: NotificationDeliveryDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO notification_delivery (
          id, notification_id, user_id, workspace, channel, status, recipient_email,
          provider, provider_message_id, attempt_count, max_attempts, next_attempt_at,
          locked_until, lease_token, last_error, sent_at, created_at, updated_at
        ) VALUES (
          ${input.id}, ${input.notification_id}, ${input.user_id}, ${input.workspace}, ${input.channel},
          ${input.status ?? 'pending'}, ${input.recipient_email}, ${input.provider ?? null},
          ${input.provider_message_id ?? null}, ${input.attempt_count ?? 0}, ${input.max_attempts},
          ${input.next_attempt_at}, ${input.locked_until ?? null}, ${input.lease_token ?? null},
          ${input.last_error ?? null}, ${input.sent_at ?? null}, ${input.created_at},
          ${input.updated_at ?? input.created_at}
        )
        ON CONFLICT (notification_id, channel) DO NOTHING
        RETURNING *
      `;
      if (row) return notificationDeliveryMappers.delivery(row);
      const [existing] = await this.sql<DatabaseRow[]>`
        SELECT * FROM notification_delivery
        WHERE notification_id = ${input.notification_id} AND channel = ${input.channel}
      `;
      return notificationDeliveryMappers.delivery(existing!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async claimPending(workspace: string, limit: number, now: Date, leaseDurationMs: number) {
    try {
      return await this.sql.begin(async transaction => {
        const sql = transaction as unknown as PostgresSqlClient;
        const rows = await sql<DatabaseRow[]>`
          SELECT * FROM notification_delivery
          WHERE workspace = ${workspace} AND channel = 'email'
            AND (
              (status = 'pending' AND next_attempt_at <= ${now})
              OR (status = 'processing' AND locked_until <= ${now})
            )
          ORDER BY next_attempt_at, created_at, id
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;
        const result: NotificationDeliveryClaim[] = [];
        for (const row of rows) {
          const leaseToken = randomUUID();
          const [claimed] = await sql<DatabaseRow[]>`
            UPDATE notification_delivery
            SET status = 'processing', attempt_count = attempt_count + 1,
                locked_until = ${new Date(now.getTime() + leaseDurationMs)},
                lease_token = ${leaseToken}, updated_at = ${now}
            WHERE id = ${String(row['id'])}
            RETURNING *
          `;
          if (claimed) result.push({ ...notificationDeliveryMappers.delivery(claimed), lease_token: leaseToken });
        }
        return result;
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async markSent(id: string, leaseToken: string, provider: string, providerMessageId: string, sentAt: Date) {
    try {
      const rows = await this.sql`
        UPDATE notification_delivery
        SET status = 'sent', provider = ${provider}, provider_message_id = ${providerMessageId},
            sent_at = ${sentAt}, locked_until = NULL, lease_token = NULL, updated_at = ${sentAt}
        WHERE id = ${id} AND status = 'processing' AND lease_token = ${leaseToken}
        RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async markRetry(id: string, leaseToken: string, nextAttemptAt: Date, error: string, updatedAt: Date) {
    try {
      const rows = await this.sql`
        UPDATE notification_delivery
        SET status = 'pending', next_attempt_at = ${nextAttemptAt}, last_error = ${error.slice(0, 2000)},
            locked_until = NULL, lease_token = NULL, updated_at = ${updatedAt}
        WHERE id = ${id} AND status = 'processing' AND lease_token = ${leaseToken}
        RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async markFailed(id: string, leaseToken: string, error: string, completedAt: Date) {
    try {
      const rows = await this.sql`
        UPDATE notification_delivery
        SET status = 'failed', last_error = ${error.slice(0, 2000)}, locked_until = NULL,
            lease_token = NULL, updated_at = ${completedAt}
        WHERE id = ${id} AND status = 'processing' AND lease_token = ${leaseToken}
        RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async markSkipped(id: string, leaseToken: string, reason: string, completedAt: Date) {
    try {
      const rows = await this.sql`
        UPDATE notification_delivery
        SET status = 'skipped', last_error = ${reason.slice(0, 2000)}, locked_until = NULL,
            lease_token = NULL, updated_at = ${completedAt}
        WHERE id = ${id} AND status = 'processing' AND lease_token = ${leaseToken}
        RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
