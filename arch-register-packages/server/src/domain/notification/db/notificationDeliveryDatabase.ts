import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';

export type NotificationDeliveryChannel = 'email' | 'slack' | 'sms';
export type NotificationDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';

export type NotificationDeliveryDbResult = {
  id: string;
  notification_id: string;
  user_id: string;
  workspace: string;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  recipient_email: string;
  provider: string | null;
  provider_message_id: string | null;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: Date;
  locked_until: Date | null;
  lease_token: string | null;
  last_error: string | null;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type NotificationDeliveryDbCreate = Omit<
  NotificationDeliveryDbResult,
  | 'status'
  | 'provider'
  | 'provider_message_id'
  | 'attempt_count'
  | 'locked_until'
  | 'lease_token'
  | 'last_error'
  | 'sent_at'
  | 'updated_at'
> & {
  status?: NotificationDeliveryStatus;
  provider?: string | null;
  provider_message_id?: string | null;
  attempt_count?: number;
  locked_until?: Date | null;
  lease_token?: string | null;
  last_error?: string | null;
  sent_at?: Date | null;
  updated_at?: Date;
};

export type NotificationDeliveryClaim = NotificationDeliveryDbResult & {
  lease_token: string;
};

export type NotificationDeliveryDatabase = {
  createDelivery(input: NotificationDeliveryDbCreate): Promise<NotificationDeliveryDbResult>;
  claimPending(
    workspace: string,
    limit: number,
    now: Date,
    leaseDurationMs: number
  ): Promise<NotificationDeliveryClaim[]>;
  markSent(
    id: string,
    leaseToken: string,
    provider: string,
    providerMessageId: string,
    sentAt: Date
  ): Promise<boolean>;
  markRetry(
    id: string,
    leaseToken: string,
    nextAttemptAt: Date,
    error: string,
    updatedAt: Date
  ): Promise<boolean>;
  markFailed(id: string, leaseToken: string, error: string, completedAt: Date): Promise<boolean>;
  markSkipped(id: string, leaseToken: string, reason: string, completedAt: Date): Promise<boolean>;
};

export const notificationDeliveryMappers = {
  delivery: (row: DatabaseRow): NotificationDeliveryDbResult => ({
    id: String(row['id']),
    notification_id: String(row['notification_id']),
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    channel: String(row['channel']) as NotificationDeliveryChannel,
    status: String(row['status']) as NotificationDeliveryStatus,
    recipient_email: String(row['recipient_email']),
    provider: row['provider'] == null ? null : String(row['provider']),
    provider_message_id:
      row['provider_message_id'] == null ? null : String(row['provider_message_id']),
    attempt_count: Number(row['attempt_count'] ?? 0),
    max_attempts: Number(row['max_attempts'] ?? 5),
    next_attempt_at: databaseDate(row['next_attempt_at']),
    locked_until: row['locked_until'] == null ? null : databaseDate(row['locked_until']),
    lease_token: row['lease_token'] == null ? null : String(row['lease_token']),
    last_error: row['last_error'] == null ? null : String(row['last_error']),
    sent_at: row['sent_at'] == null ? null : databaseDate(row['sent_at']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  })
};
