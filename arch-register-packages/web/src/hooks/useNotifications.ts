import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  clearNotifications,
  createWatch,
  deleteNotification,
  deleteWatch,
  fetchNotificationCount,
  fetchNotifications,
  fetchWatchedEntities
} from '../lib/api';

export const notificationKeys = {
  all: ['notifications'] as const,
  watched: (workspaceId: string) => [...notificationKeys.all, 'watching', workspaceId] as const,
  list: (workspaceId: string) => [...notificationKeys.all, 'list', workspaceId] as const,
  count: (workspaceId: string) => [...notificationKeys.all, 'count', workspaceId] as const
};

export const invalidateNotificationQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationKeys.watched(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.count(workspaceId) })
  ]);
};

export const useWatchedEntities = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.watched(workspaceId),
    queryFn: () => fetchWatchedEntities(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const useNotifications = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.list(workspaceId),
    queryFn: () => fetchNotifications(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const useNotificationCount = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.count(workspaceId),
    queryFn: () => fetchNotificationCount(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const useCreateWatch = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) => createWatch(workspaceId, entityId),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};

export const useDeleteWatch = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) => deleteWatch(workspaceId, entityId),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};

export const useDeleteNotification = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(workspaceId, notificationId),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};

export const useClearNotifications = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearNotifications(workspaceId),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};
