import { randomUUID } from 'node:crypto';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  NotificationDeliveryClaim,
  NotificationDeliveryDatabase,
  NotificationDeliveryDbCreate
} from './notificationDeliveryDatabase';
import { notificationDeliveryMappers } from './notificationDeliveryDatabase';

export class SqliteNotificationDeliveryDatabase
  extends SqliteDatabaseBase
  implements NotificationDeliveryDatabase
{
  async createDelivery(input: NotificationDeliveryDbCreate) {
    const now = input.updated_at ?? input.created_at;
    this.run(
      `INSERT OR IGNORE INTO notification_delivery (
        id, notification_id, user_id, workspace, channel, status, recipient_email,
        provider, provider_message_id, attempt_count, max_attempts, next_attempt_at,
        locked_until, lease_token, last_error, sent_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.notification_id,
        input.user_id,
        input.workspace,
        input.channel,
        input.status ?? 'pending',
        input.recipient_email,
        input.provider ?? null,
        input.provider_message_id ?? null,
        input.attempt_count ?? 0,
        input.max_attempts,
        input.next_attempt_at.toISOString(),
        input.locked_until?.toISOString() ?? null,
        input.lease_token ?? null,
        input.last_error ?? null,
        input.sent_at?.toISOString() ?? null,
        input.created_at.toISOString(),
        now.toISOString()
      ]
    );
    return (await this.get(
      'SELECT * FROM notification_delivery WHERE notification_id = ? AND channel = ?',
      [input.notification_id, input.channel],
      notificationDeliveryMappers.delivery
    ))!;
  }

  async claimPending(workspace: string, limit: number, now: Date, leaseDurationMs: number) {
    const claim = this.db.transaction(() => {
      const candidates = this.all<{ id: string }>(
        `SELECT id FROM notification_delivery
         WHERE workspace = ? AND channel = 'email'
           AND (
             (status = 'pending' AND next_attempt_at <= ?)
             OR (status = 'processing' AND locked_until <= ?)
           )
         ORDER BY next_attempt_at, created_at, id
         LIMIT ?`,
        [workspace, now.toISOString(), now.toISOString(), limit]
      );
      const result: NotificationDeliveryClaim[] = [];
      for (const candidate of candidates) {
        const leaseToken = randomUUID();
        const updated = this.run(
          `UPDATE notification_delivery
           SET status = 'processing', attempt_count = attempt_count + 1,
               locked_until = ?, lease_token = ?, updated_at = ?
           WHERE id = ? AND (
             (status = 'pending' AND next_attempt_at <= ?)
             OR (status = 'processing' AND locked_until <= ?)
           )`,
          [
            new Date(now.getTime() + leaseDurationMs).toISOString(),
            leaseToken,
            now.toISOString(),
            candidate.id,
            now.toISOString(),
            now.toISOString()
          ]
        );
        if (updated.changes === 0) continue;
        const row = this.get(
          'SELECT * FROM notification_delivery WHERE id = ?',
          [candidate.id],
          notificationDeliveryMappers.delivery
        );
        if (row) result.push({ ...row, lease_token: leaseToken });
      }
      return result;
    });
    return claim();
  }

  async markSent(
    id: string,
    leaseToken: string,
    provider: string,
    providerMessageId: string,
    sentAt: Date
  ) {
    return (
      this.run(
        `UPDATE notification_delivery
         SET status = 'sent', provider = ?, provider_message_id = ?, sent_at = ?,
             locked_until = NULL, lease_token = NULL, updated_at = ?
         WHERE id = ? AND status = 'processing' AND lease_token = ?`,
        [provider, providerMessageId, sentAt.toISOString(), sentAt.toISOString(), id, leaseToken]
      ).changes > 0
    );
  }

  async markRetry(
    id: string,
    leaseToken: string,
    nextAttemptAt: Date,
    error: string,
    updatedAt: Date
  ) {
    return (
      this.run(
        `UPDATE notification_delivery
         SET status = 'pending', next_attempt_at = ?, last_error = ?,
             locked_until = NULL, lease_token = NULL, updated_at = ?
         WHERE id = ? AND status = 'processing' AND lease_token = ?`,
        [nextAttemptAt.toISOString(), error.slice(0, 2000), updatedAt.toISOString(), id, leaseToken]
      ).changes > 0
    );
  }

  async markFailed(id: string, leaseToken: string, error: string, completedAt: Date) {
    return (
      this.run(
        `UPDATE notification_delivery
         SET status = 'failed', last_error = ?, locked_until = NULL,
             lease_token = NULL, updated_at = ?
         WHERE id = ? AND status = 'processing' AND lease_token = ?`,
        [error.slice(0, 2000), completedAt.toISOString(), id, leaseToken]
      ).changes > 0
    );
  }

  async markSkipped(id: string, leaseToken: string, reason: string, completedAt: Date) {
    return (
      this.run(
        `UPDATE notification_delivery
         SET status = 'skipped', last_error = ?, locked_until = NULL,
             lease_token = NULL, updated_at = ?
         WHERE id = ? AND status = 'processing' AND lease_token = ?`,
        [reason.slice(0, 2000), completedAt.toISOString(), id, leaseToken]
      ).changes > 0
    );
  }
}
