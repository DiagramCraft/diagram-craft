import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { PinnedEntity } from '@arch-register/api-types/watchContract';
import { orpcClient } from '../lib/orpcClient';

export const notificationKeys = {
  all: ['notifications'] as const,
  watched: (workspaceId: string) => [...notificationKeys.all, 'watching', workspaceId] as const,
  pinned: (workspaceId: string) => [...notificationKeys.all, 'pinned', workspaceId] as const,
  list: (workspaceId: string) => [...notificationKeys.all, 'list', workspaceId] as const,
  count: (workspaceId: string) => [...notificationKeys.all, 'count', workspaceId] as const
};

export const watchedEntitiesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: notificationKeys.watched(workspaceId),
    queryFn: () => orpcClient.watching.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const pinnedEntitiesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: notificationKeys.pinned(workspaceId),
    queryFn: () => orpcClient.pinnedEntities.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const notificationsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: notificationKeys.list(workspaceId),
    queryFn: () => orpcClient.notifications.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const notificationCountQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: notificationKeys.count(workspaceId),
    queryFn: () => orpcClient.notifications.count({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000
  });

export const invalidateNotificationQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationKeys.watched(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.pinned(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.count(workspaceId) })
  ]);
};

export type PinnedEntityCacheContext = { previousPinned: PinnedEntity[] };

export const addPinnedEntityToCache = async (
  queryClient: QueryClient,
  workspaceId: string,
  entity: PinnedEntity
): Promise<PinnedEntityCacheContext> => {
  const key = notificationKeys.pinned(workspaceId);
  await queryClient.cancelQueries({ queryKey: key });
  const previousPinned = queryClient.getQueryData<PinnedEntity[]>(key) ?? [];
  if (!previousPinned.some(item => item.entity_id === entity.entity_id)) {
    queryClient.setQueryData<PinnedEntity[]>(key, [entity, ...previousPinned]);
  }
  return { previousPinned };
};

export const removePinnedEntityFromCache = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
): Promise<PinnedEntityCacheContext> => {
  const key = notificationKeys.pinned(workspaceId);
  await queryClient.cancelQueries({ queryKey: key });
  const previousPinned = queryClient.getQueryData<PinnedEntity[]>(key) ?? [];
  queryClient.setQueryData<PinnedEntity[]>(
    key,
    previousPinned.filter(item => item.entity_id !== entityId)
  );
  return { previousPinned };
};

export const restorePinnedEntitiesCache = (
  queryClient: QueryClient,
  workspaceId: string,
  context: PinnedEntityCacheContext | undefined
) => {
  queryClient.setQueryData(notificationKeys.pinned(workspaceId), context?.previousPinned ?? []);
};

export const invalidatePinnedEntities = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: notificationKeys.pinned(workspaceId) });
