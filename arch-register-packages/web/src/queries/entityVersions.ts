import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';
import { entityKeys } from './entities';
import { orpcClient } from '../lib/orpcClient';

export const entityVersionKeys = {
  all: ['entityVersions'] as const,
  list: (workspaceId: string, entityId: string) =>
    [...entityVersionKeys.all, workspaceId, entityId] as const
};

export const entityVersionsQuery = (workspaceId: string, entityId: string, enabled = false) =>
  queryOptions({
    queryKey: entityVersionKeys.list(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entityVersions.list({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId && enabled
  });

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

export const invalidatePromotedEntityVersion = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => {
  await Promise.all([
    invalidateEntityVersionQueries(queryClient, workspaceId, entityId),
    queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) })
  ]);
};
