import { AuditLogEntryRow, AuditOperation } from '../../audit/db/auditDatabase';

export type UserWatchRow = {
  user_id: string;
  workspace: string;
  entity_id: string;
  created_at: Date;
};

export type CreateUserWatchInput = UserWatchRow;

export type UserNotificationRow = {
  id: string;
  user_id: string;
  workspace: string;
  entity_id: string;
  audit_log_id: string;
  operation: AuditOperation;
  entity_name: string;
  entity_slug: string;
  schema_id: string | null;
  changed_by_user_id: string;
  changed_by_display_name: string;
  timestamp: Date;
  created_at: Date;
};

export type CreateNotificationsFromAuditInput = {
  auditLog: AuditLogEntryRow;
  changedByDisplayName: string;
  watcherUserIds?: string[];
};

export type WatchDatabase = {
  listWatcherUserIds(workspace: string, entityId: string): Promise<string[]>;
  listWatches(userId: string, workspace: string): Promise<UserWatchRow[]>;
  getWatch(userId: string, workspace: string, entityId: string): Promise<UserWatchRow | null>;
  createWatch(input: CreateUserWatchInput): Promise<UserWatchRow>;
  deleteWatch(userId: string, workspace: string, entityId: string): Promise<UserWatchRow | null>;

  listNotifications(userId: string, workspace: string): Promise<UserNotificationRow[]>;
  deleteNotification(
    userId: string,
    workspace: string,
    notificationId: string
  ): Promise<UserNotificationRow | null>;

  clearNotifications(userId: string, workspace: string): Promise<number>;
  createNotificationsFromAudit(input: CreateNotificationsFromAuditInput): Promise<void>;
};
