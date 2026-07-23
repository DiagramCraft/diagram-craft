import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { entityKeys, invalidateEntityDetails } from '../queries/entities';
import { snapshotKeys, invalidateSnapshotQueries } from '../queries/snapshots';
import { orpcClient } from '../lib/orpcClient';

export const useEntitySnapshots = (workspaceId: string, entityId: string, enabled = false) =>
  useQuery({
    queryKey: snapshotKeys.list(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entities.snapshots.list({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId && enabled
  });

export const usePromoteSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commitMessage }: { commitMessage?: string }) => {
      const snapshots = await orpcClient.entities.snapshots.list({
        params: { workspace: workspaceId, id: entityId }
      });
      const latestAutosave = snapshots.find(s => s.status === 'autosave');
      if (!latestAutosave) throw new Error('No autosave snapshot found to promote');
      return orpcClient.entities.snapshots.promote({
        params: { workspace: workspaceId, id: entityId, snapshotId: latestAutosave.id },
        body: { commitMessage }
      });
    },
    onSuccess: () => {
      invalidateSnapshotQueries(queryClient, workspaceId, entityId);
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) });
    }
  });
};

export const useRestoreSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { snapshotId: string; commitMessage?: string }) =>
      orpcClient.entities.snapshots.restore({
        params: { workspace: workspaceId, id: entityId, snapshotId: params.snapshotId },
        body: { commitMessage: params.commitMessage }
      }),
    onSuccess: () => {
      invalidateEntityDetails(queryClient, workspaceId, entityId);
      invalidateSnapshotQueries(queryClient, workspaceId, entityId);
    }
  });
};

export const useProjectFutureSnapshots = (workspaceId: string, projectId: string) =>
  useQuery({
    queryKey: snapshotKeys.byProject(workspaceId, projectId),
    queryFn: () =>
      orpcClient.entities.snapshots.listByProject({
        params: { workspace: workspaceId, projectId }
      }),
    enabled: !!workspaceId && !!projectId
  });
