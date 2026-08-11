import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type {
  NotificationChannel,
  NotificationType
} from '@arch-register/api-types/notificationPreferencesContract';
import { orpcClient } from '../lib/orpcClient';

export type NotificationPreferenceInput = {
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}[];

export const notificationPreferenceKeys = {
  all: (workspaceId: string) => ['notification-preferences', workspaceId] as const
};

export const notificationPreferencesQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: notificationPreferenceKeys.all(workspaceId),
    queryFn: () => orpcClient.notificationPreferences.get({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });

export const setNotificationPreferencesCache = (
  queryClient: QueryClient,
  workspaceId: string,
  data: unknown
) => queryClient.setQueryData(notificationPreferenceKeys.all(workspaceId), data);
