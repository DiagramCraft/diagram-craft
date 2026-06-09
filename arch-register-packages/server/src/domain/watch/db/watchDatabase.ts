import { AuditLogDbResult, AuditOperation } from '../../audit/db/auditDatabase';

export type WatchDbResult = {
  user_id: string;
  workspace: string;
  entity_id: string;
  created_at: Date;
};

export type WatchDbCreate = WatchDbResult;

export type NotificationDbResult = {
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
  auditLog: AuditLogDbResult;
  changedByDisplayName: string;
  watcherUserIds?: string[];
};

export type WatchDatabase = {
  listWatcherUserIds(workspace: string, entityId: string): Promise<string[]>;
  listWatches(userId: string, workspace: string): Promise<WatchDbResult[]>;
  getWatch(userId: string, workspace: string, entityId: string): Promise<WatchDbResult | null>;
  createWatch(input: WatchDbCreate): Promise<WatchDbResult>;
  deleteWatch(userId: string, workspace: string, entityId: string): Promise<WatchDbResult | null>;

  listNotifications(userId: string, workspace: string): Promise<NotificationDbResult[]>;
  deleteNotification(
    userId: string,
    workspace: string,
    notificationId: string
  ): Promise<NotificationDbResult | null>;

  clearNotifications(userId: string, workspace: string): Promise<number>;
  createNotificationsFromAudit(arg: CreateNotificationsFromAuditInput): Promise<void>;
};
