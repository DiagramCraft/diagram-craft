import type { QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';

export const entityTimelineKeys = {
  all: ['entityTimeline'] as const,
  batch: (workspaceId: string, entityIds: string[]) =>
    [...entityTimelineKeys.all, workspaceId, entityIds] as const
};

export const invalidateEntityTimelineQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityTimelineKeys.all }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};
