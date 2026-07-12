import { AuditLogDbResult, AuditOperation } from '../../audit/db/auditDatabase';
import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';

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

export const watchMappers = {
  watch: (row: DatabaseRow): WatchDbResult => ({
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    created_at: databaseDate(row['created_at'])
  }),
  notification: (row: DatabaseRow): NotificationDbResult => ({
    id: String(row['id']),
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    audit_log_id: String(row['audit_log_id']),
    operation: row['operation'] as NotificationDbResult['operation'],
    entity_name: String(row['entity_name']),
    entity_slug: String(row['entity_slug']),
    schema_id: row['schema_id'] == null ? null : String(row['schema_id']),
    changed_by_user_id: String(row['changed_by_user_id']),
    changed_by_display_name: String(row['changed_by_display_name']),
    timestamp: databaseDate(row['timestamp']),
    created_at: databaseDate(row['created_at'])
  })
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
