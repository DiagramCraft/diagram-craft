import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationChannel,
  NotificationType
} from '@arch-register/api-types/notificationPreferencesContract';
import { orpcClient } from '../lib/orpcClient';
import {
  notificationPreferenceKeys as notificationPreferenceKeysFromQueries,
  notificationPreferencesQuery,
  setNotificationPreferencesCache
} from '../queries/notificationPreferences';

export const notificationPreferenceKeys = notificationPreferenceKeysFromQueries;

export const useNotificationPreferences = (workspaceId: string) =>
  useQuery(notificationPreferencesQuery(workspaceId));

export const useUpdateNotificationPreferences = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      preferences: {
        notificationType: NotificationType;
        channel: NotificationChannel;
        enabled: boolean;
      }[]
    ) =>
      orpcClient.notificationPreferences.update({
        params: { workspace: workspaceId },
        body: { preferences }
      }),
    onSuccess: data => {
      setNotificationPreferencesCache(queryClient, workspaceId, data);
    }
  });
};
