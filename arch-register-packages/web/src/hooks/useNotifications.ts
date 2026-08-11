import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import {
  addPinnedEntityToCache,
  invalidateNotificationQueries,
  invalidatePinnedEntities,
  notificationCountQuery,
  notificationsQuery,
  pinnedEntitiesQuery,
  removePinnedEntityFromCache,
  restorePinnedEntitiesCache,
  watchedEntitiesQuery
} from '../queries/notifications';

export const useWatchedEntities = (workspaceId: string, enabled = true) =>
  useQuery(watchedEntitiesQuery(workspaceId, enabled));

export const usePinnedEntities = (workspaceId: string, enabled = true) =>
  useQuery(pinnedEntitiesQuery(workspaceId, enabled));

export const useNotifications = (workspaceId: string, enabled = true) =>
  useQuery(notificationsQuery(workspaceId, enabled));

export const useNotificationCount = (workspaceId: string, enabled = true) =>
  useQuery(notificationCountQuery(workspaceId, enabled));

export const useCreateWatch = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.watching.create({
        params: { workspace: workspaceId },
        body: { entity_id: entityId }
      }),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};

export const useDeleteWatch = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.watching.remove({ params: { workspace: workspaceId, id: entityId } }),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};

export const useCreatePinnedEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entity: {
      entityId: string;
      entityPublicId: string;
      entityName: string;
      entitySlug: string;
      schemaId: string;
    }) =>
      orpcClient.pinnedEntities.create({
        params: { workspace: workspaceId },
        body: { entity_id: entity.entityId }
      }),
    onMutate: async entity => {
      return addPinnedEntityToCache(queryClient, workspaceId, {
        entity_id: entity.entityId,
        entity_public_id: entity.entityPublicId,
        entity_name: entity.entityName,
        entity_slug: entity.entitySlug,
        schema_id: entity.schemaId,
        created_at: new Date().toISOString()
      });
    },
    onError: (_error, _entity, context) => {
      restorePinnedEntitiesCache(queryClient, workspaceId, context);
    },
    onSettled: async () => {
      await invalidatePinnedEntities(queryClient, workspaceId);
    }
  });
};

export const useDeletePinnedEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.pinnedEntities.remove({ params: { workspace: workspaceId, id: entityId } }),
    onMutate: async entityId => {
      return removePinnedEntityFromCache(queryClient, workspaceId, entityId);
    },
    onError: (_error, _entityId, context) => {
      restorePinnedEntitiesCache(queryClient, workspaceId, context);
    },
    onSettled: async () => {
      await invalidatePinnedEntities(queryClient, workspaceId);
    }
  });
};

export const useDeleteNotification = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      orpcClient.notifications.remove({ params: { workspace: workspaceId, id: notificationId } }),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};

export const useClearNotifications = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => orpcClient.notifications.clear({ params: { workspace: workspaceId } }),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};
