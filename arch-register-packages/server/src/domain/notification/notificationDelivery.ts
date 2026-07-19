import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { InboxNotificationDbResult } from './db/notificationDatabase';

export const createEmailDelivery = async (
  db: DatabaseAdapter,
  notification: InboxNotificationDbResult,
  recipientEmail: string,
  now = new Date()
) =>
  db.notificationDelivery.createDelivery({
    id: randomUUID(),
    notification_id: notification.id,
    user_id: notification.user_id,
    workspace: notification.workspace,
    channel: 'email',
    recipient_email: recipientEmail,
    max_attempts: 5,
    next_attempt_at: now,
    created_at: now
  });
