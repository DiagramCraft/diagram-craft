import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MergeExecuteBody } from '@arch-register/api-types/entityMergeContract';
import { orpcClient } from '../lib/orpcClient';
import {
  invalidateEntityDeletion,
  invalidateEntityDetails,
  invalidateEntityQueries
} from '../queries/entities';
import { invalidateEntityVersionQueries } from '../queries/entityVersions';

// Preview is a mutation (not a query) because it's triggered explicitly on wizard step
// transitions and re-run on demand ("refresh and re-review"), not cached/reactive like the rest
// of the entity read hooks.
export const useEntityMergePreview = (workspaceId: string) =>
  useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      orpcClient.entityMerges.preview({
        params: { workspace: workspaceId, id: sourceId },
        body: { targetId }
      })
  });

export const useExecuteEntityMerge = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sourceId, body }: { sourceId: string; body: MergeExecuteBody }) =>
      orpcClient.entityMerges.execute({
        params: { workspace: workspaceId, id: sourceId },
        body
      }),
    onSuccess: async (response, { sourceId }) => {
      // The source entity is retired (resolved via the alias table going forward), so drop it
      // from caches the same way a delete does; the target gained new field/relation data.
      await Promise.all([
        invalidateEntityDeletion(queryClient, workspaceId, sourceId),
        invalidateEntityDetails(queryClient, workspaceId, response.targetId),
        invalidateEntityVersionQueries(queryClient, workspaceId, response.targetId),
        invalidateEntityQueries(queryClient, workspaceId)
      ]);
    }
  });
};
