import type { QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';

export const snapshotKeys = {
  all: ['snapshots'] as const,
  list: (workspaceId: string, entityId: string) =>
    [...snapshotKeys.all, workspaceId, entityId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...snapshotKeys.all, 'by-project', workspaceId, projectId] as const
};

export const invalidateSnapshotQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string,
  projectId?: string | null
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: snapshotKeys.list(workspaceId, entityId) }),
    invalidateAuditQueries(queryClient, workspaceId),
    ...(projectId
      ? [
          queryClient.invalidateQueries({
            queryKey: snapshotKeys.byProject(workspaceId, projectId)
          })
        ]
      : [])
  ]);
};
