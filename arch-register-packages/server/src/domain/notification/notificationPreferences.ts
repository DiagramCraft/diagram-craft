import type { DatabaseAdapter } from '../../db/database';
import {
  NOTIFICATION_TYPE_CATALOG,
  type NotificationChannel,
  type NotificationType
} from './notificationPreferenceCatalog';

export const isChannelEnabled = async (
  db: DatabaseAdapter,
  userId: string,
  workspace: string,
  notificationType: NotificationType,
  channel: NotificationChannel
): Promise<boolean> => {
  const overrides = await db.notificationPreference.listOverrides(userId, workspace);
  const override = overrides.find(
    entry => entry.notification_type === notificationType && entry.channel === channel
  );
  if (override) return override.enabled;
  return NOTIFICATION_TYPE_CATALOG[notificationType].defaultChannels.includes(channel);
};
