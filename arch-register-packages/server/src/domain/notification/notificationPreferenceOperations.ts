import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import {
  NOTIFICATION_CHANNEL_CATALOG,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPE_CATALOG,
  NOTIFICATION_TYPES,
  isNotificationChannel,
  isNotificationType
} from './notificationPreferenceCatalog';
import type { NotificationPreferencesResponse } from '@arch-register/api-types/notificationPreferencesContract';

const buildResponse = (
  overrides: { notification_type: string; channel: string; enabled: boolean }[]
): NotificationPreferencesResponse => {
  const preferences = NOTIFICATION_TYPES.flatMap(notificationType =>
    NOTIFICATION_CHANNELS.map(channel => {
      const override = overrides.find(
        entry => entry.notification_type === notificationType && entry.channel === channel
      );
      const enabled = override
        ? override.enabled
        : NOTIFICATION_TYPE_CATALOG[notificationType].defaultChannels.includes(channel);
      return { notificationType, channel, enabled, isDefault: !override };
    })
  );

  return {
    notificationTypes: NOTIFICATION_TYPES.map(notificationType => ({
      notificationType,
      label: NOTIFICATION_TYPE_CATALOG[notificationType].label,
      description: NOTIFICATION_TYPE_CATALOG[notificationType].description,
      category: NOTIFICATION_TYPE_CATALOG[notificationType].category
    })),
    channels: NOTIFICATION_CHANNELS.map(channel => ({
      channel,
      label: NOTIFICATION_CHANNEL_CATALOG[channel].label,
      implemented: NOTIFICATION_CHANNEL_CATALOG[channel].implemented
    })),
    preferences
  };
};

export const getNotificationPreferences = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<NotificationPreferencesResponse> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const overrides = await db.notificationPreference.listOverrides(event.context.user.id, ws);
  return buildResponse(overrides);
};

export const updateNotificationPreferences = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  entries: { notificationType: string; channel: string; enabled: boolean }[]
): Promise<NotificationPreferencesResponse> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  for (const entry of entries) {
    httpAssert.true(isNotificationType(entry.notificationType), {
      status: 400,
      message: `Unknown notification type '${entry.notificationType}'`
    });
    httpAssert.true(isNotificationChannel(entry.channel), {
      status: 400,
      message: `Unknown notification channel '${entry.channel}'`
    });
  }

  await db.notificationPreference.setOverrides(event.context.user.id, ws, entries);
  const overrides = await db.notificationPreference.listOverrides(event.context.user.id, ws);
  return buildResponse(overrides);
};
