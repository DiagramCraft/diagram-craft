import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';
import { orpcClient } from '../lib/orpcClient';

export const entityTimelineKeys = {
  all: ['entityTimeline'] as const,
  batch: (workspaceId: string, entityIds: string[]) =>
    [...entityTimelineKeys.all, workspaceId, entityIds] as const
};

export const entityTimelineBatchQuery = (
  workspaceId: string,
  entityIds: string[],
  enabled = true
) =>
  queryOptions({
    queryKey: entityTimelineKeys.batch(workspaceId, entityIds),
    queryFn: () =>
      orpcClient.entities.timelineView({
        params: { workspace: workspaceId },
        body: { ids: entityIds }
      }),
    enabled: enabled && !!workspaceId && entityIds.length > 0
  });

export const invalidateEntityTimelineQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityTimelineKeys.all }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};
