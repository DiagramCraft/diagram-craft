import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCollectionRequest } from '@arch-register/api-types/collectionContract';
import { invalidateEntityQueries } from '../queries/entities';
import { collectionsQuery, invalidateCollectionQueries } from '../queries/collections';
import { orpcClient } from '../lib/orpcClient';

export const useCollections = (
  workspaceId: string,
  entityId?: string | null,
  options?: { enabled?: boolean }
) => useQuery(collectionsQuery(workspaceId, entityId, options?.enabled ?? true));

export const useCreateCollection = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCollectionRequest) =>
      orpcClient.collections.create({ params: { workspace: workspaceId }, body }),
    onSuccess: () => invalidateCollectionQueries(queryClient, workspaceId)
  });
};

export const useUpdateCollection = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      orpcClient.collections.update({
        params: { workspace: workspaceId, id },
        body: { name }
      }),
    onSuccess: () => invalidateCollectionQueries(queryClient, workspaceId)
  });
};

export const useDeleteCollection = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.collections.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: async () => {
      await invalidateCollectionQueries(queryClient, workspaceId);
      await invalidateEntityQueries(queryClient, workspaceId);
    }
  });
};

export const useAddEntityToCollection = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, entityId }: { collectionId: string; entityId: string }) =>
      orpcClient.collections.addEntity({
        params: { workspace: workspaceId, id: collectionId },
        body: { entity_id: entityId }
      }),
    onSuccess: async () => {
      await invalidateCollectionQueries(queryClient, workspaceId);
      await invalidateEntityQueries(queryClient, workspaceId);
    }
  });
};

export const useRemoveEntityFromCollection = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, entityId }: { collectionId: string; entityId: string }) =>
      orpcClient.collections.removeEntity({
        params: { workspace: workspaceId, id: collectionId, entityId }
      }),
    onSuccess: async () => {
      await invalidateCollectionQueries(queryClient, workspaceId);
      await invalidateEntityQueries(queryClient, workspaceId);
    }
  });
};
