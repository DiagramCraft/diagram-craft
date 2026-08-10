import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PinnedEntity } from '@arch-register/api-types/watchContract';
import { orpcClient } from '../lib/orpcClient';
import { invalidateNotificationQueries, notificationKeys } from '../queries/notifications';

export const useWatchedEntities = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.watched(workspaceId),
    queryFn: () => orpcClient.watching.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const usePinnedEntities = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.pinned(workspaceId),
    queryFn: () => orpcClient.pinnedEntities.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const useNotifications = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.list(workspaceId),
    queryFn: () => orpcClient.notifications.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000
  });

export const useNotificationCount = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.count(workspaceId),
    queryFn: () => orpcClient.notifications.count({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000
  });

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
      await queryClient.cancelQueries({ queryKey: notificationKeys.pinned(workspaceId) });
      const previousPinned =
        queryClient.getQueryData<PinnedEntity[]>(notificationKeys.pinned(workspaceId)) ?? [];

      const alreadyPinned = previousPinned.some(item => item.entity_id === entity.entityId);
      if (!alreadyPinned) {
        queryClient.setQueryData<PinnedEntity[]>(notificationKeys.pinned(workspaceId), [
          {
            entity_id: entity.entityId,
            entity_public_id: entity.entityPublicId,
            entity_name: entity.entityName,
            entity_slug: entity.entitySlug,
            schema_id: entity.schemaId,
            created_at: new Date().toISOString()
          },
          ...previousPinned
        ]);
      }

      return { previousPinned };
    },
    onError: (_error, _entity, context) => {
      queryClient.setQueryData(notificationKeys.pinned(workspaceId), context?.previousPinned ?? []);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.pinned(workspaceId) });
    }
  });
};

export const useDeletePinnedEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.pinnedEntities.remove({ params: { workspace: workspaceId, id: entityId } }),
    onMutate: async entityId => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.pinned(workspaceId) });
      const previousPinned =
        queryClient.getQueryData<PinnedEntity[]>(notificationKeys.pinned(workspaceId)) ?? [];

      queryClient.setQueryData<PinnedEntity[]>(
        notificationKeys.pinned(workspaceId),
        previousPinned.filter(item => item.entity_id !== entityId)
      );

      return { previousPinned };
    },
    onError: (_error, _entityId, context) => {
      queryClient.setQueryData(notificationKeys.pinned(workspaceId), context?.previousPinned ?? []);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.pinned(workspaceId) });
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
