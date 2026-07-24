import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationChannel,
  NotificationType
} from '@arch-register/api-types/notificationPreferencesContract';
import { orpcClient } from '../lib/orpcClient';

export const notificationPreferenceKeys = {
  all: (workspaceId: string) => ['notification-preferences', workspaceId] as const
};

export const useNotificationPreferences = (workspaceId: string) =>
  useQuery({
    queryKey: notificationPreferenceKeys.all(workspaceId),
    queryFn: () => orpcClient.notificationPreferences.get({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });

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
      queryClient.setQueryData(notificationPreferenceKeys.all(workspaceId), data);
    }
  });
};
