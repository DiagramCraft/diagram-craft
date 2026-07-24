import { databaseBoolean, databaseDate, type DatabaseRow } from '../../../db/rowMappers';

export type NotificationPreferenceDbResult = {
  user_id: string;
  workspace: string;
  notification_type: string;
  channel: string;
  enabled: boolean;
  updated_at: Date;
};

export type NotificationPreferenceOverride = {
  notificationType: string;
  channel: string;
  enabled: boolean;
};

export const notificationPreferenceMappers = {
  preference: (row: DatabaseRow): NotificationPreferenceDbResult => ({
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    notification_type: String(row['notification_type']),
    channel: String(row['channel']),
    enabled: databaseBoolean(row['enabled']),
    updated_at: databaseDate(row['updated_at'])
  })
};

export type NotificationPreferenceDatabase = {
  listOverrides(userId: string, workspace: string): Promise<NotificationPreferenceDbResult[]>;
  setOverrides(
    userId: string,
    workspace: string,
    entries: NotificationPreferenceOverride[]
  ): Promise<void>;
};
