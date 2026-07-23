import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { entityKeys, invalidateEntityDetails } from '../queries/entities';
import { snapshotKeys, invalidateSnapshotQueries } from '../queries/snapshots';
import { changeCaseKeys } from '../queries/changeCases';
import { orpcClient } from '../lib/orpcClient';
import { toLegacyEntitySnapshots, toLegacyProjectSnapshots } from '../lib/legacySnapshotAdapter';

// Bridges the split entityVersions/changeCases APIs into the merged EntitySnapshot shape that
// the timeline UI (TimelineView, EntityChangeHistoryTab, snapshotDisplay, timelineViewState)
// still renders — see legacySnapshotAdapter.ts. A follow-up issue tracks rewriting those
// components to consume the split shapes natively instead of through this adapter.
export const fetchLegacyEntitySnapshots = async (workspaceId: string, entityId: string) => {
  const [versions, cases] = await Promise.all([
    orpcClient.entityVersions.list({ params: { workspace: workspaceId, id: entityId } }),
    orpcClient.changeCases.listByEntity({ params: { workspace: workspaceId, id: entityId } })
  ]);
  return toLegacyEntitySnapshots(workspaceId, entityId, versions, cases);
};

export const useEntitySnapshots = (workspaceId: string, entityId: string, enabled = false) =>
  useQuery({
    queryKey: snapshotKeys.list(workspaceId, entityId),
    queryFn: () => fetchLegacyEntitySnapshots(workspaceId, entityId),
    enabled: !!workspaceId && !!entityId && enabled
  });

export const useRestoreSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { snapshotId: string; commitMessage?: string }) =>
      orpcClient.entityVersions.restore({
        params: { workspace: workspaceId, id: entityId, versionId: params.snapshotId },
        body: { commitMessage: params.commitMessage }
      }),
    onSuccess: () => {
      invalidateEntityDetails(queryClient, workspaceId, entityId);
      invalidateSnapshotQueries(queryClient, workspaceId, entityId);
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) });
    }
  });
};

export const useProjectFutureSnapshots = (workspaceId: string, projectId: string) =>
  useQuery({
    queryKey: snapshotKeys.byProject(workspaceId, projectId),
    queryFn: async () => {
      const cases = await orpcClient.changeCases.listByProject({
        params: { workspace: workspaceId, id: projectId }
      });
      return toLegacyProjectSnapshots(workspaceId, cases);
    },
    enabled: !!workspaceId && !!projectId
  });

// Used by TimelineView's per-entity batch fetch (useQueries) in "group by project" mode.
export const legacySnapshotQuery = (workspaceId: string, entityId: string) => ({
  queryKey: [
    ...snapshotKeys.list(workspaceId, entityId),
    ...changeCaseKeys.byEntity(workspaceId, entityId)
  ],
  queryFn: () => fetchLegacyEntitySnapshots(workspaceId, entityId),
  enabled: !!workspaceId && !!entityId
});
