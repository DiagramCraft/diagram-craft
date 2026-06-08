import type { AuditLogEntry, UserNotification, UserWatch } from '../../../types';

export type CreateUserWatchInput = UserWatch;

export type CreateNotificationsFromAuditInput = {
  auditLog: AuditLogEntry;
  changedByDisplayName: string;
  watcherUserIds?: string[];
};

export type WatchDatabase = {
  listWatcherUserIds(workspace: string, entityId: string): Promise<string[]>;
  listWatches(userId: string, workspace: string): Promise<UserWatch[]>;
  getWatch(userId: string, workspace: string, entityId: string): Promise<UserWatch | null>;
  createWatch(input: CreateUserWatchInput): Promise<UserWatch>;
  deleteWatch(userId: string, workspace: string, entityId: string): Promise<UserWatch | null>;
  listNotifications(userId: string, workspace: string): Promise<UserNotification[]>;
  deleteNotification(
    userId: string,
    workspace: string,
    notificationId: string
  ): Promise<UserNotification | null>;
  clearNotifications(userId: string, workspace: string): Promise<number>;
  createNotificationsFromAudit(input: CreateNotificationsFromAuditInput): Promise<void>;
};
