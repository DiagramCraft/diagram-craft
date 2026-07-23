import type { QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';

export const entityVersionKeys = {
  all: ['entityVersions'] as const,
  list: (workspaceId: string, entityId: string) =>
    [...entityVersionKeys.all, workspaceId, entityId] as const
};

export const invalidateEntityVersionQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityVersionKeys.list(workspaceId, entityId) }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};
