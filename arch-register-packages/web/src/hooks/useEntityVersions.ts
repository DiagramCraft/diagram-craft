import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { entityKeys, invalidateEntityDetails } from '../queries/entities';
import { entityVersionKeys, invalidateEntityVersionQueries } from '../queries/entityVersions';
import { orpcClient } from '../lib/orpcClient';

export const useEntityVersions = (workspaceId: string, entityId: string, enabled = false) =>
  useQuery({
    queryKey: entityVersionKeys.list(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entityVersions.list({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId && enabled
  });

export const usePromoteEntityVersion = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commitMessage }: { commitMessage?: string }) => {
      const versions = await orpcClient.entityVersions.list({
        params: { workspace: workspaceId, id: entityId }
      });
      const latestAutosave = versions.find(v => v.kind === 'autosave');
      if (!latestAutosave) throw new Error('No autosave version found to promote');
      return orpcClient.entityVersions.promote({
        params: { workspace: workspaceId, id: entityId, versionId: latestAutosave.id },
        body: { commitMessage }
      });
    },
    onSuccess: () => {
      invalidateEntityVersionQueries(queryClient, workspaceId, entityId);
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) });
    }
  });
};

export const useRestoreEntityVersion = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { versionId: string; commitMessage?: string }) =>
      orpcClient.entityVersions.restore({
        params: { workspace: workspaceId, id: entityId, versionId: params.versionId },
        body: { commitMessage: params.commitMessage }
      }),
    onSuccess: () => {
      invalidateEntityDetails(queryClient, workspaceId, entityId);
      invalidateEntityVersionQueries(queryClient, workspaceId, entityId);
    }
  });
};
