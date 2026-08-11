import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';
import { orpcClient } from '../lib/orpcClient';

export const milestoneKeys = {
  all: ['milestones'] as const,
  lists: () => [...milestoneKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId?: string) =>
    [...milestoneKeys.lists(), workspaceId, projectId ?? 'all'] as const,
  details: () => [...milestoneKeys.all, 'detail'] as const,
  detail: (workspaceId: string, milestoneId: string) =>
    [...milestoneKeys.details(), workspaceId, milestoneId] as const
};

export const milestonesQuery = (workspaceId: string, projectId?: string, enabled = true) =>
  queryOptions({
    queryKey: milestoneKeys.list(workspaceId, projectId),
    queryFn: () =>
      orpcClient.milestones.list({
        params: { workspace: workspaceId },
        query: { project_id: projectId }
      }),
    enabled: enabled && !!workspaceId
  });

export const invalidateMilestoneQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  milestoneId?: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: milestoneKeys.list(workspaceId) }),
    ...(milestoneId
      ? [
          queryClient.invalidateQueries({
            queryKey: milestoneKeys.detail(workspaceId, milestoneId)
          })
        ]
      : []),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};
