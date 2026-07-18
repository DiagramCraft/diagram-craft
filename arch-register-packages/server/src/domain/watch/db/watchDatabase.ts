import { AuditLogDbResult } from '../../audit/db/auditDatabase';
import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';

export type WatchDbResult = {
  user_id: string;
  workspace: string;
  entity_id: string;
  created_at: Date;
};

export type WatchDbCreate = WatchDbResult;

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
  })
};

export type WatchDatabase = {
  listWatcherUserIds(workspace: string, entityId: string): Promise<string[]>;
  listWatches(userId: string, workspace: string): Promise<WatchDbResult[]>;
  getWatch(userId: string, workspace: string, entityId: string): Promise<WatchDbResult | null>;
  createWatch(input: WatchDbCreate): Promise<WatchDbResult>;
  deleteWatch(userId: string, workspace: string, entityId: string): Promise<WatchDbResult | null>;

  /** Fans out an inbox notification (`user_inbox_notification`) to every watcher of the entity. */
  createNotificationsFromAudit(arg: CreateNotificationsFromAuditInput): Promise<void>;
};
