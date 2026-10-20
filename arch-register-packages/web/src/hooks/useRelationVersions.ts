import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateRestoredRelation, relationVersionsQuery } from '../queries/relationVersions';
import { orpcClient } from '../lib/orpcClient';

export const useRelationVersions = (workspaceId: string, relationId: string, enabled = false) =>
  useQuery(relationVersionsQuery(workspaceId, relationId, enabled));

export const useRestoreRelationVersion = (workspaceId: string, relationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { versionId: string; commitMessage?: string }) =>
      orpcClient.relationVersions.restore({
        params: { workspace: workspaceId, id: relationId, versionId: params.versionId },
        body: { commitMessage: params.commitMessage }
      }),
    onSuccess: () => {
      invalidateRestoredRelation(queryClient, workspaceId, relationId);
    }
  });
};
